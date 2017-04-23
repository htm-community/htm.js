/**
 * An cell matrix is a container which holds a collection of cells, indexes
 * of the active, predictive, and learning cells, state history, and common
 * utility functions.
 * 
 */
function CellMatrix( params, cells ) {
	var my = this;
	
	this.params = params;
	this.cells = ( ( typeof cells === 'undefined' ) ? [] : cells );
	this.activeCells = [];     // Array of only the active cells
	this.learningCells = [];   // Array of only the learning cells
	this.predictiveCells = []; // Array of only the predictive cells

	this.activeCellHistory = [];     // Reverse-order history of active cells
	this.learningCellHistory = [];   // Reverse-order history of learning cells
	this.predictiveCellHistory = []; // Reverse-order history of predictive cells
	
	
	/**
	 * Resets the active and learning states after saving them to history
	 */
	this.resetActiveStates = function() {
		var c, s, cell;
		// Save active cells history
		my.activeCellHistory.unshift( my.activeCells );
		if( my.activeCellHistory.length > my.params.historyLength ) {
			my.activeCellHistory.length = my.params.historyLength;
		}
		// Reset active cells
		for( c = 0; c < my.activeCells.length; c++ ) {
			cell = my.activeCells[c];
			cell.active = false;
			cell.distalLearnSegment = null; // Reset previous distal learn segment
			cell.apicalLearnSegment = null; // Reset previous apical learn segment
			// If cell is in a column, clear segment activity (this isn't used for cells which feed SP)
			if( cell.column !== null ) {
				// Clear previous references to segment activity
				for( s = 0; s < cell.axonSynapses.length; s++ ) {
					synapse = cell.axonSynapses[s];
					// Make sure we haven't already processed this segment's active synapses list
					if( synapse.segment.activeSynapses.length > 0 ) {
						// Save active synapses history, then clear in preparation for new input
						synapse.segment.activeSynapsesHistory.unshift( synapse.segment.activeSynapses );
						if( synapse.segment.activeSynapsesHistory.length > my.params.historyLength ) {
							synapse.segment.activeSynapsesHistory.length = my.params.historyLength;
						}
						synapse.segment.activeSynapses = [];
					}
					// Make sure we haven't already processed this segment's connected synapses list
					if( synapse.segment.connectedSynapses.length > 0 ) {
						// Save connected synapses history, then clear in preparation for new input
						synapse.segment.connectedSynapsesHistory.unshift( synapse.segment.connectedSynapses );
						if( synapse.segment.connectedSynapsesHistory.length > my.params.historyLength ) {
							synapse.segment.connectedSynapsesHistory.length = my.params.historyLength;
						}
						synapse.segment.connectedSynapses = [];
					}
				}
			}
		}
		// Clear active cells array
		my.activeCells = [];
		// Save learning cells history
		my.learningCellHistory.unshift( my.learningCells );
		if( my.learningCellHistory.length > my.params.historyLength ) {
			my.learningCellHistory.length = my.params.historyLength;
		}
		// Reset learning cells
		for( c = 0; c < my.learningCells.length; c++ ) {
			cell = my.learningCells[c];
			cell.learning = false;
		}
		// Clear learning cells array
		my.learningCells = [];
	}

	/**
	 * Resets the predictictive states after saving them to history
	 */
	this.resetPredictiveStates = function() {
		var c, cell;
		// Save predictive cells history
		my.predictiveCellHistory.unshift( my.predictiveCells );
		if( my.predictiveCellHistory.length > my.params.historyLength ) {
			my.predictiveCellHistory.length = my.params.historyLength;
		}
		// Reset predictive cells
		for( c = 0; c < my.predictiveCells.length; c++ ) {
			cell = my.predictiveCells[c];
			cell.predictive = false;
			cell.distalLearnSegment = null;  // Reset previous distal learn segment
			cell.apicalLearnSegment = null;  // Reset previous apical learn segment
		}
		// Clear predictive cells array
		my.predictiveCells = [];
	}
	
	/**
	 * This function clears all references
	 */
	this.clear = function() {
		if( my !== null ) {
			my.cells = null;
			my.activeCells = null;
			my.predictiveCells = null;
			my.learningCells = null;
			my.activeCellHistory = null;
			my.learningCellHistory = null;
			my.predictiveCellHistory = null;
			my.params = null;
			my = null;
		}
	}
}
