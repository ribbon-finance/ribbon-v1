import {
  BuyInstrumentCall,
  Exercised1 as Exercised,
  ExercisePositionCall,
} from "../generated/templates/Instrument/Instrument";
import { InstrumentPosition, OptionExercise } from "../generated/schema";

export function handleBuyInstrument(call: BuyInstrumentCall): void {
  let positionID = call.from.toHex() + "-" + call.outputs.positionID.toString();
  let position = new InstrumentPosition(positionID);
  position.account = call.from;
  position.cost = call.transaction.value;
  position.exercised = false;
  position.save();
}

export function handleExercisePosition(call: ExercisePositionCall): void {
  let positionID = call.from.toHex() + "-" + call.inputs.positionID.toString();
  let position = InstrumentPosition.load(positionID);

  if (position !== null) {
    position.exercised = true;
    position.save();
  }

  let optionExercise = new OptionExercise(call.transaction.hash.toHex());
  optionExercise.instrumentPosition = positionID;
  optionExercise.account = call.from;
}

export function handleOptionExercise(event: Exercised): void {
  let redemption = new OptionExercise(event.transaction.hash.toHex());
  redemption.optionID = event.params.optionID.toI32();
  redemption.amount = event.params.amount;
  redemption.exerciseProfit = event.params.exerciseProfit;
  redemption.save();
}
