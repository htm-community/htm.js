/**
 * Global constants
 * ("const" not supported by IE, so using "var")
 */
var PROXIMAL   = 0;
var DISTAL     = 1;
var APICAL     = 2;

/**
 * The HTMController contains high-level HTM functions.
 * 
 */
function HTMController() {
	var my = this; // Reference to self, for use in functions
	
	this.layers = []; // Each layer created is stored here for easy lookup
	
	this.timestep = 0; // Used for tracking least recently used resources
	
	// Defaults to use for any param not specified:
	this.defaultParams = {
		'columnCount'               :  2048,
		'cellsPerColumn'            :    32,
		'activationThreshold'       :    13,
		'initialPermanence'         :    21,  // %
		'connectedPermanence'       :    50,  // %
		'minThreshold'              :    10,
		'maxNewSynapseCount'        :    32,
		'permanenceIncrement'       :    10,  // %
		'permanenceDecrement'       :    10,  // %
		'predictedSegmentDecrement' :     1,  // %
		'maxSegmentsPerCell'        :   128,
		'maxSynapsesPerSegment'     :   128,
		'potentialPercent'          :    50,  // %
		'sparsity'                  :     2,  // %
		'inputCellCount'            :  1024,
		'skipSpatialPooling'        : false,
		'historyLength'             :     2
	};
	
	/**
	 * This function creates a cell matrix containing the number of
	 * input cells specifed in the params, and returns it.
	 */
	this.createInputCells = function( params ) {
		var i, cell;
		// Create a matrix to hold the new cells
		var inputCells = new CellMatrix( params );
		// Generate the specified number of input cells
		for( i = 0; i < params.inputCellCount; i++ ) {
			cell = new Cell( inputCells, i );
		}
		// Return the cell matrix
		return inputCells;
	}
	
	/**
	 * This function generates a new temporal memory layer.  If spatial
	 * pooling is enabled, a matrix of input cells is also created,
	 * containing the number specified in the params.
	 * 
	 * (a TM layer is one which receives distal input from its own cells)
	 */
	this.createTmLayer = function( params ) {
		// Override default params with any provided
		var layerParams = my.defaultParams;
		if( ( typeof params !== 'undefined' ) && ( params !== null ) ) {
			for( var property in params ) {
				if( params.hasOwnProperty( property ) ) {
					layerParams[property] = params[property];
				}
			}
		}
		
		// If spatial pooling is enabled, create a matrix of input cells
		var inputCells = null; 
		if( !layerParams.skipSpatialPooling ) {
			inputCells = my.createInputCells( layerParams );
		}
		// Create the layer
		var layer = new Layer( layerParams, [inputCells] );
		// Set the layer's distal input to its own cell matrix
		layer.distalInput = layer.cellMatrix;
		my.layers.push( layer ); // Save for easy lookup
		
		return my; // Allows chaining function calls
	}
	
	/**
	 * This function activates the columns in a layer which best match the input,
	 * and if learning is enabled, adjusts the columns to better match the input.
	 * 
	 * Note: The active input SDRs must align with the proximal input cell matrices
	 * in the layer.
	 */
	this.spatialPooling = function( layerIdx, activeInputSDRs, learningEnabled ) {
		var c, i, input, indexes, synapse, column, cell;
		var learn = ( ( typeof learningEnabled === 'undefined' ) ? false : learningEnabled );
		var layer = my.layers[layerIdx];
		
		// Clear input cell states
		for( i = 0; i < layer.proximalInputs.length; i++ ) {
			layer.proximalInputs[i].resetActiveStates().resetPredictiveStates();
		}
		
		// Reset the column scores
		for( i = 0; i < layer.columns.length; i++ ) {
			layer.columns[i].score = 0;
		}
		
		// Update active state of input cells which match the specified SDR.
		// If learning is enabled, also set their learn state.
		for( i = 0; i < activeInputSDRs.length; i++ ) {
			indexes = activeInputSDRs[i];
			input = layer.proximalInputs[i];
			for( c = 0; c < indexes.length; c++ ) {
				cell = input.cells[indexes[c]];
				cell.active = true;
				input.activeCells.push( cell );
				if( learn ) { // Learning enabled, set learn states
					cell.learning = true;
					input.learningCells.push( cell );
				}
			}
			// Activate input cells (also calculates the column scores)
			my.activateCellMatrix( input, my.timestep + 1 ); // Timestep incremented in TM phase
		}
		
		// Select the columns with the highest scores to become active
		var bestColumns = [];
		var activeColumnCount = parseInt( ( parseFloat( layer.params.sparsity ) / 100 ) * layer.params.columnCount );
		if( activeColumnCount < 1 ) {
			activeColumnCount = 1;
		}
		for( i = 0; i < layer.columns.length; i++ ) {
			column = layer.columns[i];
			for( c = 0; c < activeColumnCount; c++ ) {
				if( ( !( c in bestColumns ) ) || bestColumns[c].score < column.score ) {
					bestColumns.splice( c, 0, column );
					if( bestColumns.length > activeColumnCount ) {
						bestColumns.length = activeColumnCount;
					}
					break;
				}
			}
		}
		
		// SP learning
		if( learn ) {
			for( i = 0; i < activeColumnCount; i++ ) {
				column = bestColumns[i];
				for( c = 0; c < column.proximalSegment.synapses.length; c++ ) {
					synapse = column.proximalSegment.synapses[c];
					if( synapse.cellTx.active ) {
						synapse.permanence += layer.params.permanenceIncrement;
						if( synapse.permanence > 100 ) {
							synapse.permanence = 100;
						}
					} else {
						synapse.permanence -= layer.params.permanenceDecrement;
						if( synapse.permanence < 0 ) {
							synapse.permanence = 0;
						}
					}
				}
			}
		}
		
		layer.activeColumns = bestColumns;
		return my; // Allows chaining function calls
	}
	
	/**
	 * This function activates cells in the active columns, generates predictions, and
	 * if learning is enabled, learns new temporal patterns.
	 */
	this.temporalMemory = function( layerIdx, learningEnabled ) {
		var learn = ( ( typeof learningEnabled === 'undefined' ) ? false : learningEnabled );
		var layer = my.layers[layerIdx];
		
		my.timestep++;
		
		// Phase 1: Activate
		my.tmActivate( layer, learn );
		
		// Phase 2: Predict
		my.tmPredict( layer );
		
		// Phase 3: Learn
		if( learn ) {
			my.tmLearn( layer );
		}
		return my; // Allows chaining function calls
	}
	
	/**
	 * This function allows the input cells to grow apical connections with the active cells in
	 * the specified layer, allowing next inputs to be predicted.  This is designed to replace
	 * the heavier-weight classifier logic for making predictions one timestep in the future.
	 */
	this.inputMemory = function( layerIdx ) {
		var i;
		var layer = my.layers[layerIdx];
		
		for( i = 0; i < layer.proximalInputs.length; i++ ) {
			my.trainCellMatrix( layer.cellMatrix, layer.proximalInputs[i], APICAL );
		}
	}
	
	/**
	 * Activates cells in each active column, and selects cells to learn in the next
	 * timestep.  Activity is queued up, but not transmitted to receiving cells until
	 * tmPredict() is executed.
	 * 
	 * This is Phase 1 of the temporal memory process.
	 */
	this.tmActivate = function( layer, learn ) {
		var i, c, x, predicted, column, cell, learningCell, synapse;
		
		// Reset this layer's active cell states after saving history.
		layer.cellMatrix.resetActiveStates();
		
		// Loop through each active column and activate cells
		for( i = 0; i < layer.activeColumns.length; i++ ) {
			column = layer.activeColumns[i];
			predicted = false;
			for( c = 0; c < column.cells.length; c++ ) {
				cell = column.cells[c];
				if( cell.predictive ) {
					cell.active = true; // Activate predictive cell
					layer.cellMatrix.activeCells.push( cell );
					if( learn ) {
						cell.learning = true;  // Flag cell for learning
						layer.cellMatrix.learningCells.push( cell );
					}
					predicted = true;  // Input was predicted
				}
			}
			if( !predicted ) {
				// Input was not predicted, activate all cells in column
				for( c = 0; c < column.cells.length; c++ ) {
					cell = column.cells[c];
					cell.active = true;
					layer.cellMatrix.activeCells.push( cell );
				}
				if( learn ) {
					// Select a cell for learning
					if( column.bestDistalSegment === null ) {
						// No segments matched the input, pick least used cell to learn
						x = Math.floor( Math.random() * column.cells.length );
						learningCell = column.cells[x];  // Start with a random cell
						// Loop through all cells to find one with fewest segments
						for( c = 0; c < column.cells.length; c++ ) {
							cell = column.cells[x];
							if( cell.distalSegments.length < learningCell.distalSegments.length ){
								learningCell = cell;  // Fewer segments, use this one
							}
							x++;
							if( x >= column.cells.length ) {
								x = 0; // Wrap around to beginning of cells array
							}
						}
						learningCell.learning = true;  // Flag chosen cell to learn
						layer.cellMatrix.learningCells.push( learningCell );
					} else {
						// Flag cell with best matching segment to learn
						column.bestDistalSegment.cellRx.learning = true;
						layer.cellMatrix.learningCells.push( column.bestDistalSegment.cellRx );
					}
				}
			}
		}
	}
	
	/**
	 * Transmits queued activity, driving cells into predictive state based on
	 * distal or apical connections with active cells.  Also identifies the
	 * distal and apical segments that best match the current activity, which
	 * is later used when tmLearn() is executed.
	 * 
	 * This is Phase 2 of the temporal memory process.
	 */
	this.tmPredict = function( layer ) {
		var i, c, column, cell, synapse;
		
		// Reset this layer's predictive cell states after saving history.
		layer.cellMatrix.resetPredictiveStates();
		
		// Save column best matching segments history, and clear references
		for( i = 0; i < layer.columns.length; i++ ) {
			// Save best matching distal segment history
			column = layer.columns[i];
			column.bestDistalSegmentHistory.unshift( column.bestDistalSegment );
			if( column.bestDistalSegmentHistory.length > layer.params.historyLength ) {
				column.bestDistalSegmentHistory.length = layer.params.historyLength;
			}
			// Clear reference to best matching distal segment
			column.bestDistalSegment = null;
			// Save best matching apical segment history
			column.bestApicalSegmentHistory.unshift( column.bestApicalSegment );
			if( column.bestApicalSegmentHistory.length > layer.params.historyLength ) {
				column.bestApicalSegmentHistory.length = layer.params.historyLength;
			}
			// Clear reference to best matching apical segment
			column.bestApicalSegment = null;
		}
		
		// Transmit queued activity to receiving synapses to generate predictions
		my.activateCellMatrix( layer.cellMatrix, my.timestep );
	}
	
	/**
	 * This function allows cells in a layer to grow distal connections with other cells
	 * in the same layer, allowing next state to be predicted. Enforces good predictions
	 * and degrades wrong predictions.
	 * 
	 * This is Phase 3 of the temporal memory process.
	 */
	this.tmLearn = function( layer ) {
		
		my.trainCellMatrix( layer.distalInput, layer.cellMatrix, DISTAL );
	}
	
	/**
	 * Activates the cells in a matrix which have had their "active" flag set.
	 * If cells are feeding a spatial pooler, increases the scores of the columns
	 * they are connected to.  Otherwise, transmits to dendrites of other receiving
	 * cells, and may place them into predictive or active states.
	 */
	this.activateCellMatrix = function( cellMatrix, timestep ) {
		var c, s, column, cell, synapse;
		
		for( c = 0; c < cellMatrix.activeCells.length; c++ ) {
			cell = cellMatrix.activeCells[c];
			// Activate synapses along the cell's axon
			for( s = 0; s < cell.axonSynapses.length; s++ ) {
				synapse = cell.axonSynapses[s];
				synapse.segment.lastUsedTimestep = timestep; // Update segment's last used timestep
				if( synapse.segment.cellRx === null ) {
					// This is the proximal segment of a column.  Just update the column score.
					if( synapse.permanence >= cellMatrix.params.connectedPermanence ) {
						synapse.segment.column.score++;
					}
				} else {
					// This is the segment of a cell.  Determine if state should be updated.
					// First, add to segment's active synapses list
					synapse.segment.activeSynapses.push( synapse );
					if( synapse.permanence >= cellMatrix.params.connectedPermanence ) {
						// Synapse connected, add to connected synapses list
						synapse.segment.connectedSynapses.push( synapse );
						if( synapse.segment.connectedSynapses.length >= cellMatrix.params.activationThreshold ) {
							// Number of connected synapses above threshold. Update receiving cell.
							if( !synapse.segment.cellRx.predictive ) {
								// Mark receiving cell as predictive (TODO: consider proximal segments)
								synapse.segment.cellRx.predictive = true;
								// Update the receiving cell's matrix
								synapse.segment.cellRx.matrix.predictiveCells.push( synapse.segment.cellRx );
								// Add segment to appropriate list for learning
								if( synapse.segment.type == DISTAL ) {
									synapse.segment.cellRx.distalLearnSegment = synapse.segment;
								} else if( synapse.segment.type == APICAL ) {
									// TODO: Consider cases where distal + apical should activate cell.
									synapse.segment.cellRx.apicalLearnSegment = synapse.segment;
								}
							}
						}
					}
					// If receiving cell is in a column, update best matching segment references
					if( synapse.segment.cellRx.column !== null ) {
						column = synapse.segment.cellRx.column;
						// Save a reference to the best matching distal and apical segments in the column
						if( synapse.segment.type === DISTAL ) {
							if( ( column.bestDistalSegment === null )
								|| ( synapse.segment.connectedSynapses.length > column.bestDistalSegment.connectedSynapses.length )
								|| ( synapse.segment.activeSynapses.length > column.bestDistalSegment.activeSynapses.length ) )
							{
								// Make sure segment has at least minimum number of potential synapses
								if( synapse.segment.activeSynapses.length >= cellMatrix.params.minThreshold ) {
									// This segment is a better match, use it
									column.bestDistalSegment = synapse.segment;
									synapse.segment.cellRx.distalLearnSegment = synapse.segment;
								}
							}
						} else if( synapse.segment.type === APICAL ) {
							if( ( column.bestApicalSegment === null )
								|| ( synapse.segment.connectedSynapses.length > column.bestApicalSegment.connectedSynapses.length )
								|| ( synapse.segment.activeSynapses.length > column.bestApicalSegment.activeSynapses.length ) )
							{
								// Make sure segment has at least minimum number of potential synapses
								if( synapse.segment.activeSynapses.length >= cellMatrix.params.minThreshold ) {
									// This segment is a better match, use it
									column.bestApicalSegment = synapse.segment;
									synapse.segment.cellRx.apicalLearnSegment = synapse.segment;
								}
							}
						}
					}
				}
			}
		}
	}
	
	/**
	 * Creates or adapts distal and apical segments in a receiving cell matrix to
	 * align with previously active cells in a transmitting cell matrix. Enforces
	 * good predictions and degrades wrong predictions.
	 */
	this.trainCellMatrix = function( cellMatrixTx, cellMatrixRx, inputType ) {
		var c, s, randomIndexes, cell, segment, synapse;
		
		if( ( cellMatrixTx.activeCellHistory.length > 0 ) && ( cellMatrixRx.predictiveCellHistory.length > 0 ) ) {
			// Enforce correct predictions, degrade wrong predictions
			for( c = 0; c < cellMatrixRx.predictiveCellHistory[0].length; c++ ) {
				segment = null;
				cell = cellMatrixRx.predictiveCellHistory[0][c];
				if( cell.column !== null ) {
					// Cell is part of a layer's cell matrix.
					// Make sure this cell is the one referenced by column's best segment history
					if( inputType == DISTAL
						&& cell.column.bestDistalSegmentHistory.length > 0
						&& cell.column.bestDistalSegmentHistory[0] !== null
						&& cell.column.bestDistalSegmentHistory[0].cellRx === cell )
					{
						segment = cell.column.bestDistalSegmentHistory[0];
					} else if( inputType == APICAL
						&& cell.column.bestApicalSegmentHistory.length > 0
						&& cell.column.bestApicalSegmentHistory[0] !== null
						&& cell.column.bestApicalSegmentHistory[0].cellRx === cell )
					{
						segment = cell.column.bestApicalSegmentHistory[0];
					}
				} else {
					// Cell is part of an input cell matrix.
					if( inputType == DISTAL ) {
						segment = cell.distalLearnSegment;
					} else if( inputType == APICAL ) {
						segment = cell.apicalLearnSegment;
					}
				}
				if( segment !== null
					&& segment.activeSynapsesHistory.length > 0
					&& segment.activeSynapsesHistory[0].length > 0 )
				{
					if( cell.active ) {
						// Correct prediction.  Train it to better align with activity.
						my.trainSegment( segment, cellMatrixTx.activeCellHistory[0], cellMatrixRx.params );
					} else {
						// Wrong prediction.  Degrade connections on this segment.
						for( s = 0; s < segment.synapses.length; s++ ) {
							synapse = segment.synapses[s];
							synapse.permanence -= cellMatrixRx.params.predictedSegmentDecrement;
							if( synapse.permanence < 0 ) {
								synapse.permanence = 0;
							}
						}
					}
				}
				cell.learning = false;  // Remove learning flag, so cell doesn't get double-trained
			}
			// If this isn't first input (or reset), train cells which were not predicted
			if( cellMatrixRx.learningCellHistory[0].length > 0 ) {
				// Loop through cells which have been flagged for learning
				for( c = 0; c < cellMatrixRx.learningCells.length; c++ ) {
					segment = null;
					cell = cellMatrixRx.learningCells[c];
					
					// Make sure we haven't already trained this cell
					if( cell.learning ) {
						if( cell.column !== null ) {
							// Cell is part of a layer's cell matrix
							if( inputType == DISTAL
								&& cell.column.bestDistalSegmentHistory.length > 0
								&& cell.column.bestDistalSegmentHistory[0] !== null
								&& cell.column.bestDistalSegmentHistory[0].cellRx === cell )
							{
								segment = cell.column.bestDistalSegmentHistory[0];
							}else if( inputType == APICAL
								&& cell.column.bestApicalSegmentHistory.length > 0
								&& cell.column.bestApicalSegmentHistory[0] !== null
								&& cell.column.bestApicalSegmentHistory[0].cellRx === cell )
							{
								segment = cell.column.bestApicalSegmentHistory[0];
							}
						} else {
							// Cell is part of an input cell matrix
							if( inputType == DISTAL ) {
								segment = cell.distalLearnSegment;
							} else if( inputType == APICAL ) {
								segment = cell.apicalLearnSegment;
							}
						}
						// We haven't trained this cell yet.  Check if it had a matching segment
						if( segment !== null
							&& segment.activeSynapsesHistory.length > 0
							&& segment.activeSynapsesHistory[0].length > 0 )
						{
							// Found a matching segment.  Train it to better align with activity.
							my.trainSegment( segment, cellMatrixTx.activeCellHistory[0], cellMatrixRx.params );
						} else {
							// No matching segment.  Create a new one.
							segment = new Segment( inputType, cell, cell.column );
							segment.lastUsedTimestep = my.timestep;
							// Connect segment with random sampling of previously active learning cells, up to max new synapse count
							randomIndexes = my.randomIndexes( cellMatrixTx.learningCellHistory[0].length, cellMatrixRx.params.maxNewSynapseCount, false );
							for( s = 0; s < randomIndexes.length; s++ ) {
								synapse = new Synapse( cellMatrixTx.learningCellHistory[0][randomIndexes[s]], segment, cellMatrixRx.params.initialPermanence );
							}
						}
						cell.learning = false;
					}
				}
			}
		}
	}
	
	/**
	 * Trains a segment of any type to better match the specified active cells.
	 * Active synapses are enforced, inactive synapses are degraded, and new synapses are formed
	 * with a random sampling of the active cells, up to max new synapses.
	 */
	this.trainSegment = function( segment, activeCells, params ) {
		var s, i, synapse, segments, segmentIndex, lruSegmentIndex;
		var randomIndexes = my.randomIndexes( activeCells.length, params.maxNewSynapseCount, false );
		var inactiveSynapses = segment.synapses.slice();  // Inactive synapses (will remove active ones below)
		// Enforce synapses that were active
		if( segment.activeSynapsesHistory.length > 0 ) {
			for( s = 0; s < segment.activeSynapsesHistory[0].length; s++ ) {
				synapse = segment.activeSynapsesHistory[0][s];
				synapse.permanence += params.permanenceIncrement;
				if( synapse.permanence > 100 ) {
					synapse.permanence = 100;
				}
				// Remove cell from random sampling if present (prevents duplicate connections)
				for( i = 0; i < randomIndexes.length; i++ ) {
					if( activeCells[randomIndexes[i]].index == synapse.cellTx.index ) {
						// Cell is in the random sampling, remove it
						randomIndexes.splice( i, 1 );
				        break;
				    }
				}
				// Remove synapse from the list of inactive synapses
				for( i = 0; i < inactiveSynapses.length; i++ ) {
					if( inactiveSynapses[i] === synapse ) {
						// Found it
						inactiveSynapses.splice( i, 1 );
				        break;
				    }
				}
			}
		}
		// Degrade synapses that were not active
		for( s = 0; s < inactiveSynapses.length; s++ ) {
			synapse = inactiveSynapses[s];
			synapse.permanence -= params.permanenceDecrement;
			if( synapse.permanence < 0 ) {
				synapse.permanence = 0;
			}
		}
		// Select the relevant list of segments, based on type
		if( segment.type == DISTAL ) {
			segments = segment.cellRx.distalSegments;
		} else if( segment.type == APICAL ) {
			segments = segment.cellRx.apicalSegments;
		} else {
			segments = segment.cellRx.proximalSegments;
		}
		// Connect segment with random sampling of previously active cells, up to max new synapse count
		for( i = 0; i < randomIndexes.length; i++ ) {
			if( segment.synapses.length >= params.maxSynapsesPerSegment ) {
				// Cannot add any more synapses to this segment.  Check if we can add a new segment.
				if( segments.length >= params.maxSegmentsPerCell ) {
					// Cannot add any more segments to this cell.  Select least recently used and remove it.
					segmentIndex = Math.floor( Math.random() * segments.length );
					lruSegmentIndex = segmentIndex;  // Start with a random segment index
					// Loop through segments to find least recently used
					for( s = 0; s < segments.length; s++ ) {
						segmentIndex++;
						if( segmentIndex >=  segments.length ) {
							segmentIndex = 0;  // Wrap back around to beginning of list
						}
						// Check if this segment is less recently used than selected one
						if( segments[segmentIndex].lastUsedTimestep < segments[lruSegmentIndex].lastUsedTimestep ) {
							lruSegmentIndex = segmentIndex;  // Used less recently.. select this one instead
						}
					}
				}
				// Add new segment to this cell
				segment = new Segment( segment.type, segment.cellRx, segment.cellRx.column );
				segment.lastUsedTimestep = my.timestep;
			}
			// Add new synapse to this segment
			synapse = new Synapse( activeCells[randomIndexes[i]], segment, params.initialPermanence );
		}
	}
	
	/**
	 * Returns an array of size "resultCount", containing unique indexes in the range (0, length - 1)
	 * If "ordered" is true, indexes will be in sequential order starting from a random position
	 * If "ordered" is false, indexes will be in random order
	 */
	this.randomIndexes = function( length, resultCount, ordered ) {
		var i1, i2;
		var results = [];  // Array to hold the random indexes
		var rc = resultCount;
		// Make sure not to return more results than there are available
		if( rc > length ) {
			rc = length;
		}
		if( ordered ) {
			// Start at a random index
			i1 = Math.floor( Math.random() * length );
			// Capture indexes in order from this point
			for( i2 = 0; i2 < rc; i2++ ) {
				results.push( i1 );
				i1++;
				if( i1 >= length ) {
					// End of list, loop back around to beginning
					i1 = 0;
				}
			}
		} else {
			// Create an array to hold unprocessed indexes
			var indexes = [];
			for( i1 = 0; i1 < length; i1++ ) {
				indexes.push( i1 );
			}
			// Capture random indexes out of order
			for( i2 = 0; i2 < rc; i2++ ) {
				// Pick a random element from the unprocessed list
				i1 = Math.floor( Math.random() * ( length - i2 ) );
				// Capture the index in this element
				results.push( indexes[i1] );
				// Remove it from the unprocessed list
				indexes.splice( i1, 1 );
			}
		}
		return results;
	}
	
	/**
	 * This function clears all layers
	 */
	this.clear = function() {
		// Loop through all saved layers
		var i;
		for( i = 0; i < my.layers.length; i++ ) {
			my.layers[i].clear(); // Clears all references
		}
		my.layers = []; // Empty the layers array
		return my; // Allows chaining function calls
	}
	
}
