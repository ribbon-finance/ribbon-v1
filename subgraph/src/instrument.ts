import {
  BuyInstrumentCall,
  Exercised,
} from "../generated/templates/Instrument/Instrument";
import { InstrumentPosition } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleBuyInstrument(call: BuyInstrumentCall): void {
  let positionID =
    call.to.toHex() +
    "-" +
    call.from.toHex() +
    "-" +
    call.outputs.positionID.toString();
  let position = new InstrumentPosition(positionID);
  position.instrumentAddress = call.to;
  position.account = call.from;
  position.cost = call.transaction.value;
  position.exercised = false;
  position.exerciseProfit = BigInt.fromI32(0);

  let amount = call.inputs.amount;
  position.amount = amount;

  let optionTypes = call.inputs.optionTypes;
  position.optionTypes = optionTypes;

  let strikePrices = call.inputs.strikePrices;
  position.strikePrices = strikePrices;

  let venues = call.inputs.venues;
  position.venues = venues;

  position.save();
}

export function handleExercisePosition(event: Exercised): void {
  let positionID =
    event.transaction.to.toHex() +
    "-" +
    event.params.account.toHex() +
    "-" +
    event.params.positionID.toString();

  let position = InstrumentPosition.load(positionID);
  if (position !== null) {
    position.exercised = true;
    position.exerciseProfit = event.params.totalProfit;
    position.save();
  }
}
