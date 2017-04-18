/**
 * A Layer consists of multiple columns.  The columns have feed forward
 * connections from an array of input cells.  Cells in the columns have
 * distal dendrites connecting them to other cells (either within the
 * same layer or from another layer). Cells also have apical dendrites
 * connecting them to cells in other layers or regions.
 * 
 */
function Layer() {

	// TODO: Global constants
	this.PROXIMAL   = 0;
	this.DISTAL     = 1;
	this.APICAL     = 2;
	
	var my = this;
	
	this.cells = []; // All cells in the layer
	this.columns = [];
	
	this.activeColumns = [];   // Array of only the active columns
	this.activeCells = [];     // Array of only the active cells
	this.learningCells = [];   // Array of only the learning cells
	this.predictiveCells = []; // Array of only the predictive cells

	this.activeCellHistory = []; // Reverse-order history of active cells
	this.learningCellHistory = []; // Reverse-order history of learning cells
	this.predictiveCellHistory = []; // Reverse-order history of predictive cells
	
	this.proximalInputCells = []; // Reference to cells which provide feed-forward input
	this.distalInputCells = [];   // Reference to cells which provide distal input
	this.apicalInputCells = [];   // Reference to cells which provide apical input
	
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
		'skipSpatialPooling'        : false,
		'historyLength'             :     2
	};
	this.params = {};
	
	/**
	 * This function adds a new column to the layer, and creates all of
	 * the cells in it.  If skipSpatialPooling is false, it also
	 * establishes randomly distributed proximal connections with the
	 * input cells.
	 */
	this.addColumn = function() {
		var y, z, i, p, perm, cell, synapse;
		var column = new Column( my.columns.length, my.columns.length * my.params.cellsPerColumn, my.params.cellsPerColumn, my );
		
		// Randomly connect columns to input cells
		if( !my.params.skipSpatialPooling ) {
			for( i = 0; i < my.inputCells.length; i++ ) {
				p = Math.floor( Math.random() * 100 );
				if( p < my.params.potentialPercent ) {
					perm = Math.floor( Math.random() * 100 );
					if( perm > my.params.connectedPermanence ) {
						// Start with weak connections (for faster initial learning)
						perm = my.params.connectedPermanence;
					}
					synapse = new Synapse( my.inputCells[i], column.proximalSegment, perm );
				}
			}
		}
		
		my.columns.push( column );
		return column;
	}
	
	/**
	 * This function resets all parameters to default and clears all
	 * arrays
	 */
	this.clear = function() {
		var property;
		
		// Reset parameters to defaults
		for( property in my.defaultParams ) {
			if( my.defaultParams.hasOwnProperty( property ) ) {
				my.params[property] = my.defaultParams[property];
			}
		}
		// Clear all arrays;
		my.cells = [];
		my.columns = [];
		my.inputCells = [];
		
		my.activeColumns = [];
		my.activeCells = [];
		my.learningCells = [];
		my.predictiveCells = [];
	}
	
	/**
	 * This function must be called first.  If params are not specified,
	 * defaults will be used.
	 * 
	 * Note: To skip SP, set param "skipSpatialPooling" = true, and then
	 * manually create columns with addColumn() after calling initialize()
	 * (columns will then require manual activation).
	 * 
	 */
	this.initialize = function( params, inputCells ) {
		var c, property;
		
		my.clear();
		
		my.inputCells = inputCells;
		
		// Override default params with any provided
		if( ( typeof params !== 'undefined' ) && ( params !== null ) ) {
			for( property in params ) {
				if( params.hasOwnProperty( property ) ) {
					my.params[property] = params[property];
				}
			}
		}
		
		if( !my.params.skipSpatialPooling ) {
			for( c = 0; c < my.params.columnCount; c++ ) {
				my.addColumn();
			}
		}
	}
	
}
