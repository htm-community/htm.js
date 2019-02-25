/**
 * A Segment is a section of dendrite from a receiving cell, consisting of
 * multiple synapses connecting to the axons of other transmitting cells.
 * The synapses will have varying permanence values, and not all may be
 * connected.
 * 
 */
function Segment( type, cellRx, column ) {
	
	this.type = type; // proximal, distal, or apical
	this.cellRx = cellRx;  // Receiving cell
	this.column = ( ( typeof column === 'undefined' ) ? null : column );
	
	this.lastUsedTimestep = 0;  // Used to remove least recently used segment if max per cell is exceeded
	this.synapses = [];  // Connections to axons of transmitting cells
	this.activeSynapses = [];  // both connected and potential synapses
	this.connectedSynapses = [];  // connected synapses only
	this.predictedActiveSynapses = [];  // synapses receiving input from predicted active cells
	this.activeSynapsesHistory = [];  // Reverse-order history of active synapses
	this.connectedSynapsesHistory = [];  // Reverse-order history of connected synapses
	this.predictedActiveSynapsesHistory = [];  // Reverse-order history of synapses receiving input from predicted active cells
	
	this.active = false;
	this.learning = false;
	
	if( this.cellRx !== null ) {
		if( this.type == DISTAL ) {
			this.cellRx.distalSegments.push( this );
		} else if( this.type == APICAL ) {
			this.cellRx.apicalSegments.push( this );
		} else {
			this.cellRx.proximalSegments.push( this );
		}
	}
}
