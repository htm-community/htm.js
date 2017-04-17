/**
 * A Column consists of multiple cells.  It also has a single proximal
 * segment connecting it to the input cells.
 * 
 */
function Column( index, cellIndex, cellsPerColumn, layer ) {

	// TODO: Global constants
	this.PROXIMAL   = layer.PROXIMAL;
	this.DISTAL     = layer.DISTAL;
	this.APICAL     = layer.APICAL;
	
	this.index = index;
	this.layer = layer;
	
	this.score = 0;  // How well column matches current input
	
	this.cells = [];
	
	this.proximalSegment = new Segment( this.PROXIMAL, null, this );  // Feed-forward input
	this.bestDistalSegment = null;  // Reference to distal segment best matching current input
	this.bestDistalSegmentHistory = [];  // Reverse-order history of best matching distal segments
	
	this.bestApicalSegment = null;  // Reference to apical segment best matching current input
	this.bestApicalSegmentHistory = [];  // Reverse-order history of best matching apical segments
	
	// Create the cells for this column
	var c, cell;
	for( c = 0; c < cellsPerColumn; c++ ) {
		cell = new Cell( cellIndex + c, index, c, this );
		this.cells.push( cell );
		layer.cells.push( cell );  // Also add to the layer's array of cells
	}
	
}
