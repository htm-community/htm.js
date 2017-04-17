/**
 * An input consist of a collection of cells and indexes of the active and predictive
 * cells in the collection.
 * 
 */
function Input( cells ) {
	this.cells = cells;
	this.activeIndexes = [];
	this.predictiveIndexes = [];
	
	/**
	 * This function clears all arrays
	 */
	this.clear = function() {
		this.cells = cells;
		this.activeIndexes = [];
		this.predictiveIndexes = [];
	}
	
}
