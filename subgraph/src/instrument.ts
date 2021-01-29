import {
  Exercised1 as Exercised,
  PositionCreated,
  Purchased,
} from "../generated/templates/Instrument/Instrument";
import {
  InstrumentPosition,
  OptionPurchase,
  OptionExercise,
} from "../generated/schema";

export function handlePositionCreated(event: PositionCreated): void {
  let position = new InstrumentPosition(event.transaction.hash.toHex());
  position.positionID = event.params.positionID.toI32();
  position.account = event.params.account;
  position.exercised = false;
  position.save();
}

export function handleOptionPurchased(event: Purchased): void {
  let txhash = event.transaction.hash.toHex();
  let purchaseID = txhash + "-" + event.logIndex.toString();
  let purchase = new OptionPurchase(purchaseID);
  purchase.instrumentPosition = txhash;

  let instrumentPosition = InstrumentPosition.load(txhash);
  if (instrumentPosition === null) {
    instrumentPosition = new InstrumentPosition(txhash);
  }
  purchase.account = event.params.caller;
  purchase.underlying = event.params.underlying;
  purchase.optionType = event.params.optionType;
  purchase.amount = event.params.amount;
  purchase.premium = event.params.premium;
  purchase.optionID = event.params.optionID.toI32();
  purchase.save();

  instrumentPosition.cost = instrumentPosition.cost.plus(event.params.premium);
  instrumentPosition.save();
}

export function handleOptionExercise(event: Exercised): void {
  let txhash = event.transaction.hash.toHex();

  let instrumentPosition = InstrumentPosition.load(txhash);
  if (instrumentPosition === null) {
    instrumentPosition = new InstrumentPosition(txhash);
  }

  let redemption = new OptionExercise(txhash + "-" + event.logIndex.toString());
  redemption.instrumentPosition = instrumentPosition.id;
  redemption.account = event.params.caller;
  redemption.optionID = event.params.optionID.toI32();
  redemption.amount = event.params.amount;
  redemption.exerciseProfit = event.params.exerciseProfit;
  redemption.save();

  instrumentPosition.exercised = true;
  instrumentPosition.save();
}
