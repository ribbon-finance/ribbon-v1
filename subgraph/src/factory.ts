import {
  InstrumentCreated,
  InstrumentCreated1,
} from "../generated/RibbonFactory/RibbonFactory";
import { Instrument } from "../generated/templates";

export function handleNewInstrument(event: InstrumentCreated): void {
  Instrument.create(event.params.instrumentAddress);
}

export function deprecatedHandleNewInstrument(event: InstrumentCreated1): void {
  Instrument.create(event.params.instrumentAddress);
}
