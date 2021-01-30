import { InstrumentCreated } from "../generated/RibbonFactory/RibbonFactory";
import { Instrument } from "../generated/templates";

export function handleNewInstrument(event: InstrumentCreated): void {
  Instrument.create(event.params.instrumentAddress);
}
