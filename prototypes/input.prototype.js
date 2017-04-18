/**
 * An input consist of a collection of cells and indexes of the active and predictive
 * cells in the collection.
 * 
 */
function Input( cells ) {
	var my = this;
	
	this.cells = cells;
	this.activeCells = [];     // Array of only the active cells
	this.learningCells = [];   // Array of only the learning cells
	this.predictiveCells = []; // Array of only the predictive cells

	this.activeCellHistory = [];     // Reverse-order history of active cells
	this.learningCellHistory = [];   // Reverse-order history of learning cells
	this.predictiveCellHistory = []; // Reverse-order history of predictive cells
	
	/**
	 * This function clears all arrays
	 */
	this.clear = function() {
		my.cells = [];
		my.activeCells = [];
		my.predictiveCells = [];
		my.learningCells = [];
		my.activeCellHistory = [];
		my.learningCellHistory = [];
		my.predictiveCellHistory = [];
	}
	
}
