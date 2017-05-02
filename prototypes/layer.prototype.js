/**
 * A Layer consists of multiple columns.  The columns have feed forward
 * connections from an array of input cells.  Cells in the columns have
 * distal dendrites connecting them to other cells (either within the
 * same layer or from another layer). Cells also have apical dendrites
 * connecting them to cells in other layers or regions.
 * 
 * Notes:
 * ProximalInput must be specified if spatial pooling is enabled.
 * 
 * To skip SP, set param "skipSpatialPooling" = true, and then manually
 * create columns with addColumn().  Without SP, the layer's timestep
 * must be incremented manually, as well as manual column activations
 * prior to calling htmController.temporalMemory function.
 * 
 * distalInput and apicalInput may be specified after the layer is
 * instantiated (for example, when distal input comes from the layer's
 * own cells, as required for temporal memory).
 */
function Layer( params, layerType, proximalInputs, distalInput, apicalInput ) {
	var my = this;
	
	this.columns = [];  // Array of columns contained in this layer
	this.activeColumns = [];   // Array of only the active columns
	
	this.type = ( ( typeof layerType === 'undefined' ) ? TM_LAYER : layerType );
	this.proximalInputs = ( ( typeof proximalInputs === 'undefined' ) ? [] : proximalInputs ); // Feed-forward input cells
	this.distalInput = ( ( typeof distalInput === 'undefined' ) ? null : distalInput ); // distal input cells
	this.apicalInput = ( ( typeof apicalInput === 'undefined' ) ? null : apicalInput ); // apical input cells
	
	this.params = params;
	this.cellMatrix = new CellMatrix( this.params ); // A matrix containing all cells in the layer
	
	this.timestep = 0; // Used for tracking least recently used resources
	
	// Calculate the decay constant
	// (avoids repeating these calculation numerous times when simulating decay)
	if( ( typeof this.params.meanLifetime !== 'undefined' ) && ( this.params.meanLifetime > 0 ) ) {
		this.params.decayConstant = ( 1.0 / parseFloat( this.params.meanLifetime ) );
	}
	
	/**
	 * This function adds a new column to the layer, and creates all of
	 * the cells in it.  If skipSpatialPooling is false, it also
	 * establishes randomly distributed proximal connections with the
	 * input cells.
	 */
	this.addColumn = function() {
		var i, c, p, input, perm, synapse;
		var column = new Column( my.columns.length, my.columns.length * my.params.cellsPerColumn, my.params.cellsPerColumn, my );
		
		// Randomly connect columns to input cells, for use in spatial pooling
		if( !my.params.skipSpatialPooling ) {
			for( i = 0; i < my.proximalInputs.length; i++ ) {
				input = my.proximalInputs[i];
				for( c = 0; c < input.cells.length; c++ ) {
					p = Math.floor( Math.random() * 100 );
					if( p < my.params.potentialPercent ) {
						perm = Math.floor( Math.random() * 100 );
						if( perm > my.params.connectedPermanence ) {
							// Start with weak connections (for faster initial learning)
							perm = my.params.connectedPermanence;
						}
						synapse = new Synapse( input.cells[c], column.proximalSegment, perm );
					}
				}
			}
		}
		
		my.columns.push( column );
		return column;
	}
	
	// Add the columns if spatial pooling is enabled
	if( !this.params.skipSpatialPooling ) {
		for( var c = 0; c < this.params.columnCount; c++ ) {
			this.addColumn();
		}
	}
	
	/**
	 * This function clears all references
	 */
	this.clear = function() {
		if( my !== null ) {
			my.cellMatrix.clear();
			my.cellMatrix = null;
			my.columns = null;
			my.activeColumns = null;
			my.proximalInputs = null;
			my.distalInput = null;
			my.apicalInput = null;
			my.params = null;
			my.timestep = null;
			my = null;
		}
	}
	
}
