/**
 * A Cell consists of an axon, which transmits output to other cells,
 * proximal dendrites which activate the cell, and distal and apical
 * dendrites which put the cell into a predictive state.  In some
 * cases, if both distal and apical are input, then cell will activate.
 * A cell may be inactive, active, or predictive.  It can also be
 * selected for learning.
 * 
 */
function Cell( matrix, index, x, y, column ) {
	
	this.matrix = matrix; // Reference to matrix containing the cell
	this.index = index;  // 1 dimentional index of the cell
	this.x = ( ( typeof x === 'undefined' ) ? index : x );  // 2 dimentional x index of the cell
	this.y = ( ( typeof y === 'undefined' ) ? 0 : y );  // 2 dimentional y index of the cell
	this.column = ( ( typeof column === 'undefined' ) ? null : column );  // column the cell is in
	
	this.axonSynapses = [];  // Outputs
	this.proximalSegments = [];  // Feed-forward input
	this.distalSegments = [];
	this.apicalSegments = [];
	
	this.distalLearnSegment = null;  // Distal segment to train
	this.apicalLearnSegment = null;  // Apical segment to train
	
	this.active = false;
	this.predictedActive = false; // cell was correctly predicted
	this.predictive = false;
	this.learning = false;
	
	// Add this cell to its matrix
	this.matrix.cells.push( this );
}
