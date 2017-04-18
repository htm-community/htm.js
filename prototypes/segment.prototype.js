/**
 * A Segment is a section of dendrite from a receiving cell, consisting of
 * multiple synapses connecting to the axons of other transmitting cells.
 * The synapses will have varying permanence values, and not all may be
 * connected.
 * 
 */
function Segment( type, cellRx, column ) {

	// TODO: Global constants
	this.PROXIMAL   = ( cellRx ? cellRx.PROXIMAL : column.PROXIMAL );
	this.DISTAL     = ( cellRx ? cellRx.DISTAL : column.DISTAL );
	this.APICAL     = ( cellRx ? cellRx.APICAL : column.APICAL );
	
	this.type = type; // proximal, distal, or apical
	this.cellRx = cellRx;  // Receiving cell
	this.column = ( ( typeof column === 'undefined' ) ? null : column );
	
	this.lastUsedTimestep = 0;  // Used to remove least recently used segment if max per cell is exceeded
	this.synapses = [];  // Connections to axons of transmitting cells
	this.activeSynapses = [];  // both connected and potential synapses
	this.connectedSynapses = [];  // connected synapses only
	this.activeSynapsesHistory = [];  // Reverse-order history of active synapses
	this.connectedSynapsesHistory = [];  // Reverse-order history of connected synapses
	
	this.active = false;
	this.learning = false;
	
	if( this.cellRx !== null ) {
		if( this.type == this.DISTAL ) {
			this.cellRx.distalSegments.push( this );
		} else if( this.type == this.APICAL ) {
			this.cellRx.apicalSegments.push( this );
		} else {
			this.cellRx.proximalSegments.push( this );
		}
	}
}
