import {
  BuyInstrumentCall,
  Exercised1 as Exercised,
  ExercisePositionCall,
} from "../generated/templates/Instrument/Instrument";
import { InstrumentPosition, OptionExercise } from "../generated/schema";
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

  let amounts = call.inputs.amounts;
  position.amounts = amounts;

  let optionTypes = call.inputs.optionTypes;
  position.optionTypes = optionTypes;

  let strikePrices = call.inputs.strikePrices;
  position.strikePrices = strikePrices;

  let venues = call.inputs.venues;
  position.venues = venues;

  position.save();
}

export function handleExercisePosition(call: ExercisePositionCall): void {
  let positionID =
    call.to.toHex() +
    "-" +
    call.from.toHex() +
    "-" +
    call.inputs.positionID.toString();
  let position = InstrumentPosition.load(positionID);

  if (position !== null) {
    position.exercised = true;
    position.save();
  }

  let optionExercise = new OptionExercise(call.transaction.hash.toHex());
  optionExercise.instrumentPosition = positionID;
  optionExercise.account = call.from;
  optionExercise.save();
}

export function handleOptionExercise(event: Exercised): void {
  let optionExercise = OptionExercise.load(event.transaction.hash.toHex());
  if (optionExercise !== null) {
    optionExercise.optionID = event.params.optionID.toI32();
    optionExercise.amount = event.params.amount;
    optionExercise.exerciseProfit = event.params.exerciseProfit;
    optionExercise.save();
  }
}
