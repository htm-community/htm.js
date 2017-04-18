/**
 * The HTMController contains high-level HTM functions.
 * 
 */
function HTMController() {
	var my = this;
	
	this.input = new Input();
	this.layers = [];
	
	this.timestep = 0; // Used for tracking least recently used resources
	
	/**
	 * This function clears all layers and the collection of input cells
	 */
	this.clear = function() {
		var i;
		my.input.clear();
		for( i = 0; i < my.layers.length; i++ ) {
			my.layers[i].clear();
		}
		my.layers = [];
		return my;
	}
	
	/**
	 * This function creates a collection of input cells
	 */
	this.createInputCells = function( length ) {
		var i;
		var inputCells = [];
		for( i = 0; i < length; i++ ) {
			inputCells.push( new Cell( i ) );
		}
		my.input.clear();
		my.input.cells = inputCells;
		return my;
	}
	
	/**
	 * This function generates a new layer and adds it to the array.
	 * Should only be called after creating the input array.
	 */
	this.createLayer = function( params, inputCells ) {
		var layer = new Layer();
		layer.initialize( params, ( ( typeof inputCells === 'undefined' ) ? my.input.cells : inputCells ) );
		my.layers.push( layer );
		return my;
	}
	
	/**
	 * This function activates the columns in a layer which best match the input,
	 * and if learning is enabled, adjusts the columns to better match the input.
	 */
	this.spatialPooling = function( layerIdx, activeInputSDR, learningEnabled ) {
		var c, i, synapse, column, cell;
		var learn = ( ( typeof learningEnabled === 'undefined' ) ? false : learningEnabled );
		var layer = my.layers[layerIdx];
		
		// Determine the best columns to become active for this input
		
		// Save previously active input cells
		my.input.activeCellHistory.unshift( my.input.activeCells );
		if( my.input.activeCellHistory.length > layer.params.historyLength ) {
			my.input.activeCellHistory.length = layer.params.historyLength;
		}
		my.input.predictiveCellHistory.unshift( my.input.predictiveCells );
		if( my.input.predictiveCellHistory.length > layer.params.historyLength ) {
			my.input.predictiveCellHistory.length = layer.params.historyLength;
		}
		my.input.learningCellHistory.unshift( my.input.learningCells );
		if( my.input.learningCellHistory.length > layer.params.historyLength ) {
			my.input.learningCellHistory.length = layer.params.historyLength;
		}
		
		// Clear input cell states
		my.input.activeCells = [];
		my.input.predictiveCells = [];
		my.input.learningCells = [];
		for( i = 0; i < my.input.cells.length; i++ ) {
			cell = my.input.cells[i];
			cell.active = false;
			cell.predictive = false;
			cell.learning = false;
		}
		
		// Reset the column scores
		for( i = 0; i < layer.columns.length; i++ ) {
			layer.columns[i].score = 0;
		}
		// Increase score of each column that is connected to an active input cell
		for( c = 0; c < activeInputSDR.length; c++ ) {
			i = activeInputSDR[c];
			cell = my.input.cells[i];
			cell.active = true;
			my.input.activeCells.push( cell );
			if( learn ) {
				cell.learning = true;
				my.input.learningCells.push( cell );
			}
			for( i = 0; i < cell.axonSynapses.length; i++ ) {
				synapse = cell.axonSynapses[i];
				if( synapse.permanence >= layer.params.connectedPermanence ) {
					synapse.segment.column.score++;
				}
			}
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
		return my;
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
	}
	
	/**
	 * Activates cells in each active column, and selects cells to learn in the next
	 * timestep.
	 * 
	 * This is Phase 1 of the temporal memory process.
	 */
	this.tmActivate = function( layer, learn ) {
		var i, c, x, predicted, column, cell, learningCell, synapse;
		
		// Save previous active cell history
		layer.activeCellHistory.unshift( layer.activeCells );
		if( layer.activeCellHistory.length > layer.params.historyLength ) {
			layer.activeCellHistory.length = layer.params.historyLength;
		}
		// Deactivate all cells
		for( i = 0; i < layer.activeCells.length; i++ ) {
			cell = layer.activeCells[i];
			cell.active = false;
			cell.distalLearnSegment = null; // Reset previous distal learn segment
			cell.apicalLearnSegment = null; // Reset previous apical learn segment
			// Clear previous references to segment activity
			for( c = 0; c < cell.axonSynapses.length; c++ ) {
				synapse = cell.axonSynapses[c];
				// Make sure we haven't already processed this segment's active synapses list
				if( synapse.segment.activeSynapses.length > 0 ) {
					// Save active synapses history, then clear in preparation for new input
					synapse.segment.activeSynapsesHistory.unshift( cell.axonSynapses[c].segment.activeSynapses );
					if( synapse.segment.activeSynapsesHistory.length > layer.params.historyLength ) {
						synapse.segment.activeSynapsesHistory.length = layer.params.historyLength;
					}
					synapse.segment.activeSynapses = [];
				}
				// Make sure we haven't already processed this segment's connected synapses list
				if( synapse.segment.connectedSynapses.length > 0 ) {
					// Save connected synapses history, then clear in preparation for new input
					synapse.segment.connectedSynapsesHistory.unshift( synapse.segment.connectedSynapses );
					if( synapse.segment.connectedSynapsesHistory.length > layer.params.historyLength ) {
						synapse.segment.connectedSynapsesHistory.length = layer.params.historyLength;
					}
					synapse.segment.connectedSynapses = [];
				}
			}
		}
		layer.activeCells = [];
		// Save previous learning cell history
		layer.learningCellHistory.unshift( layer.learningCells );
		if( layer.learningCellHistory.length > layer.params.historyLength ) {
			layer.learningCellHistory.length = layer.params.historyLength;
		}
		// Clear all learning flags
		for( i = 0; i < layer.learningCells.length; i++ ) {
			cell = layer.learningCells[i];
			cell.learning = false;
		}
		layer.learningCells = [];
		
		// Loop through each active column and activate cells
		for( i = 0; i < layer.activeColumns.length; i++ ) {
			column = layer.activeColumns[i];
			predicted = false;
			for( c = 0; c < column.cells.length; c++ ) {
				cell = column.cells[c];
				if( cell.predictive ) {
					cell.active = true; // Activate predictive cell
					layer.activeCells.push( cell );
					if( learn ) {
						cell.learning = true;  // Flag cell for learning
						layer.learningCells.push( cell );
					}
					predicted = true;  // Input was predicted
				}
			}
			if( !predicted ) {
				// Input was not predicted, activate all cells in column
				for( c = 0; c < column.cells.length; c++ ) {
					cell = column.cells[c];
					cell.active = true;
					layer.activeCells.push( cell );
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
						layer.learningCells.push( learningCell );
					} else {
						// Flag cell with best matching segment to learn
						column.bestDistalSegment.cellRx.learning = true;
						layer.learningCells.push( column.bestDistalSegment.cellRx );
					}
				}
			}
		}
	}
	
	/**
	 * Drives cells into predictive state base on distal or apical connections with
	 * active cells.  Also identifies the distal and apical segments which best
	 * match the current activity.
	 * 
	 * This is Phase 2 of the temporal memory process.
	 */
	this.tmPredict = function( layer ) {
		var i, c, column, cell, synapse;
		
		// Save previous predictive cell history
		layer.predictiveCellHistory.unshift( layer.predictiveCells );
		if( layer.predictiveCellHistory.length > layer.params.historyLength ) {
			layer.predictiveCellHistory.length = layer.params.historyLength;
		}
		// Clear all predictive states
		for( i = 0; i < layer.predictiveCells.length; i++ ) {
			cell = layer.predictiveCells[i];
			cell.predictive = false;
			cell.distalLearnSegment = null;  // Reset previous distal learn segment
			cell.apicalLearnSegment = null;  // Reset previous apical learn segment
		}
		layer.predictiveCells = [];
		// Save best matching distal and apical segments history, and clear references to them
		for( i = 0; i < layer.columns.length; i++ ) {
			column = layer.columns[i];
			column.bestDistalSegmentHistory.unshift( column.bestDistalSegment );
			if( column.bestDistalSegmentHistory.length > layer.params.historyLength ) {
				column.bestDistalSegmentHistory.length = layer.params.historyLength;
			}
			column.bestDistalSegment = null;
			column.bestApicalSegmentHistory.unshift( column.bestApicalSegment );
			if( column.bestApicalSegmentHistory.length > layer.params.historyLength ) {
				column.bestApicalSegmentHistory.length = layer.params.historyLength;
			}
			column.bestApicalSegment = null;
		}
		
		// Transmit along axons of active cells.  This step may cause other cells to activate or become predictive.
		for( i = 0; i < layer.activeCells.length; i++ ) {
			cell = layer.activeCells[i];
			for( c = 0; c < cell.axonSynapses.length; c++ ) {
				synapse = cell.axonSynapses[c];
				synapse.segment.lastUsedTimestep = my.timestep; // Update segment's last used timestep
				// Add to segment's active synapses list
				synapse.segment.activeSynapses.push( synapse );
				if( synapse.permanence >= layer.params.connectedPermanence ) {
					synapse.segment.connectedSynapses.push( synapse );
					if( synapse.segment.connectedSynapses.length >= layer.params.activationThreshold ) {
						// Put cell into predictive state
						if( !synapse.segment.cellRx.predictive ) {
							synapse.segment.cellRx.predictive = true;
							if( synapse.segment.type == layer.DISTAL ) {
								synapse.segment.cellRx.distalLearnSegment = synapse.segment;
							} else if( synapse.segment.type == layer.APICAL ) {
								synapse.segment.cellRx.apicalLearnSegment = synapse.segment;
							}
							if( ( typeof synapse.segment.cellRx.column !== 'undefined' ) && ( synapse.segment.cellRx.column !== null ) ) {
								synapse.segment.cellRx.column.layer.predictiveCells.push( synapse.segment.cellRx );
							}
						}
					}
				}
				// If cell is in a column, update best matching segment references
				if( ( typeof synapse.segment.cellRx.column !== 'undefined' ) && ( synapse.segment.cellRx.column !== null ) ) {
					column = synapse.segment.cellRx.column;
					// Save a reference to the best matching distal and apical segments in the column
					if( synapse.segment.type === layer.DISTAL ) {
						if( ( column.bestDistalSegment === null )
							|| ( synapse.segment.connectedSynapses.length > column.bestDistalSegment.connectedSynapses.length )
							|| ( synapse.segment.activeSynapses.length > column.bestDistalSegment.activeSynapses.length ) )
						{
							// Make sure segment has at least minimum number of potential synapses
							if( synapse.segment.activeSynapses.length >= layer.params.minThreshold ) {
								// This segment is a better match, use it
								column.bestDistalSegment = synapse.segment;
								synapse.segment.cellRx.distalLearnSegment = synapse.segment;
							}
						}
					} else if( synapse.segment.type === layer.APICAL ) {
						if( ( column.bestApicalSegment === null )
							|| ( synapse.segment.connectedSynapses.length > column.bestApicalSegment.connectedSynapses.length )
							|| ( synapse.segment.activeSynapses.length > column.bestApicalSegment.activeSynapses.length ) )
						{
							// Make sure segment has at least minimum number of potential synapses
							if( synapse.segment.activeSynapses.length >= layer.params.minThreshold ) {
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
	
	/**
	 * Creates or adapts distal segments to align with previously active cells.
	 * Enforces good predictions and degrades wrong predictions.
	 * 
	 * This is Phase 3 of the temporal memory process.
	 */
	this.tmLearn = function( layer ) {
		var i, c, randomIndexes, cell, segment, synapse;
		
		if( layer.activeCellHistory.length > 0 ) {
			// Enforce correct predictions, degrade wrong predictions
			for( i = 0; i < layer.predictiveCellHistory[0].length; i++ ) {
				cell = layer.predictiveCellHistory[0][i];
				
				if( typeof cell.column !== 'undefined'
					&& cell.column.bestDistalSegmentHistory[0] !== null
					&& cell.column.bestDistalSegmentHistory[0].cellRx === cell
					&& cell.column.bestDistalSegmentHistory[0].activeSynapsesHistory.length > 0
					&& cell.column.bestDistalSegmentHistory[0].activeSynapsesHistory[0].length > 0 )
				{
					if( cell.active ) {
						// Correct prediction.  Train it to better align with activity.
						my.trainSegment( cell.column.bestDistalSegmentHistory[0], layer.activeCellHistory[0], layer.params );
					} else {
						// Wrong prediction.  Degrade connections on this segment.
						segment = cell.column.bestDistalSegmentHistory[0];
						for( c = 0; c < segment.synapses.length; c++ ) {
							synapse = segment.synapses[c];
							synapse.permanence -= layer.params.predictedSegmentDecrement;
							if( synapse.permanence < 0 ) {
								synapse.permanence = 0;
							}
						}
					}
				}
				cell.learning = false;  // Remove learning flag, so cell doesn't get double-trained
			}
			// If this isn't first input (or reset), train cells which were not predicted
			if( layer.learningCellHistory[0].length > 0 ) {
				// Loop through cells which have been flagged for learning
				for( i = 0; i < layer.learningCells.length; i++ ) {
					cell = layer.learningCells[i];
					// Make sure we haven't already trained this cell
					if( cell.learning ) {
						// We haven't trained this cell yet.  Check for a matching distal segment
						if( typeof cell.column !== 'undefined'
							&& cell.column.bestDistalSegmentHistory[0] !== null
							&& cell.column.bestDistalSegmentHistory[0].cellRx === cell
							&& cell.column.bestDistalSegmentHistory[0].activeSynapsesHistory.length > 0
							&& cell.column.bestDistalSegmentHistory[0].activeSynapsesHistory[0].length > 0 )
						{
							// Found a matching distal segment.  Train it to better align with activity.
							my.trainSegment( cell.column.bestDistalSegmentHistory[0], layer.activeCellHistory[0], layer.params );
						} else {
							// No matching distal segment.  Create a new one.
							segment = new Segment( layer.DISTAL, cell, cell.column );
							segment.lastUsedTimestep = my.timestep;
							// Connect segment with random sampling of previously active cells, up to max new synapse count
							randomIndexes = my.randomIndexes( layer.learningCellHistory[0].length, layer.params.maxNewSynapseCount, false );
							for( c = 0; c < randomIndexes.length; c++ ) {
								synapse = new Synapse( layer.learningCellHistory[0][randomIndexes[c]], segment, layer.params.initialPermanence );
							}
						}
						cell.learning = false;
					}
				}
			}
		}
	}
	
	/**
	 * This function allows the input cells to grow apical connections with the active cells in
	 * the specified layer, allowing next inputs to be predicted.  This is designed to replace
	 * the heavier-weight classifier logic for making predictions one timestep in the future.
	 */
	this.inputLearn = function( layerIdx ) {
		var cell;
		var layer = my.layers[layerIdx];
		
		// Enforce correct predictions, degrade wrong predictions
		if( layer.activeCellHistory.length > 0 ) {
			for( i = 0; i < my.input.predictiveCellHistory[0].length; i++ ) {
				cell = my.input.predictiveCellHistory[0][i];
				if( cell.active ) {
					// Correct prediction.  Train it to better align with activity.
					my.trainSegment( cell.apicalLearnSegment, layer.activeCellHistory[0], layer.params );
				} else {
					// Wrong prediction.  Degrade connections on this segment.
					for( c = 0; c < cell.apicalLearnSegment.synapses.length; c++ ) {
						synapse = cell.apicalLearnSegment.synapses[c];
						synapse.permanence -= layer.params.predictedSegmentDecrement;
						if( synapse.permanence < 0 ) {
							synapse.permanence = 0;
						}
					}
				}
				cell.learning = false;  // Remove learning flag, so cell doesn't get double-trained
			}
		}
		// Loop through remaining cells which have been flagged for learning
		if( layer.learningCellHistory.length > 0 ) {
			for( i = 0; i < my.input.learningCells.length; i++ ) {
				cell = my.input.learningCells[i];
				// Make sure we haven't already trained this cell
				if( cell.learning ) {
					// We haven't trained this cell yet.  Check if it has a matching apical segment
					if( cell.apicalLearnSegment !== null ) {
						// Found a matching apical segment.  Train it to better align with activity.
						my.trainSegment( cell.apicalLearnSegment, layer.activeCellHistory[0], layer.params );
					} else {
						// No matching apical segment.  Create a new one.
						segment = new Segment( layer.APICAL, cell );
						cell.apicalLearnSegment = segment;
						segment.lastUsedTimestep = my.timestep;
						// Connect segment with random sampling of previously active cells, up to max new synapse count
						randomIndexes = my.randomIndexes( layer.learningCellHistory[0].length, layer.params.maxNewSynapseCount, false );
						for( c = 0; c < randomIndexes.length; c++ ) {
							synapse = new Synapse( layer.learningCellHistory[0][randomIndexes[c]], segment, layer.params.initialPermanence );
						}
					}
					cell.learning = false;
				}
			}
		}
		// Remember input cells that are in predictive state
		for( i = 0; i < my.input.cells.length; i++ ) {
			cell = my.input.cells[i];
			if( cell.predictive ) {
				my.input.predictiveCells.push( cell );
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
		if( segment.type == segment.DISTAL ) {
			segments = segment.cellRx.distalSegments;
		} else if( segment.type == segment.APICAL ) {
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
	
}
