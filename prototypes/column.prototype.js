/**
 * A Column consists of multiple cells.  It also has a single proximal
 * segment connecting it to the input cells.
 * 
 */
function Column( index, cellIndex, cellsPerColumn, layer ) {
	
	this.index = index; // Index of this column in its layer
	this.layer = layer; // Layer containing this column
	
	this.overlapActive = 0;          // Count of connections with active input cells
	this.overlapPredictedActive = 0; // Count of connections with correctly predicted input cells
	this.score = null;               // How well column matches current input
	this.persistence = 0;
	
	// Used to calculate persistence decay
	this.initialPersistence = 0;
	this.lastUsedTimestep = 0;
	
	this.cells = []; // Array of cells in this column
	
	this.proximalSegment = new Segment( PROXIMAL, null, this );  // Feed-forward input
	this.bestDistalSegment = null;  // Reference to distal segment best matching current input
	this.bestDistalSegmentHistory = [];  // Reverse-order history of best matching distal segments
	
	this.bestApicalSegment = null;  // Reference to apical segment best matching current input
	this.bestApicalSegmentHistory = [];  // Reverse-order history of best matching apical segments
	
	// Create the cells for this column
	var c, cell;
	for( c = 0; c < cellsPerColumn; c++ ) {
		cell = new Cell( layer.cellMatrix, cellIndex + c, index, c, this );
		this.cells.push( cell );
	}
	
}
