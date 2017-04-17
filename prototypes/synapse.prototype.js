/**
 * A Synapse connects a transmitting cell's axon to a dendrite segment
 * of a receiving cell.  If the value of "permanence" is below a certain
 * threshold, the synapse is considered a potential, but not connected.
 * Any value of permanence above the threshold is considered connected.
 * 
 */
function Synapse( cellTx, segment, permanence ) {
	
	this.cellTx = cellTx;  // Transmitting cell
	this.segment = segment; // Dendrite segment of receiving cell
	this.permanence = permanence;  // Connection strength
	
	// Let the transmitting cell and receiving segment know about this synapse
	this.segment.synapses.push( this );
	this.cellTx.axonSynapses.push( this );
}
