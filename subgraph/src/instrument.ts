import {
  PositionCreated,
  Purchased,
} from "../generated/templates/Instrument/Instrument";
import { InstrumentPosition, OptionPurchase } from "../generated/schema";

export function handlePositionCreated(event: PositionCreated): void {
  let position = new InstrumentPosition(event.transaction.hash.toHex());
  position.positionID = event.params.positionID.toI32();
  position.account = event.params.account;
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
  instrumentPosition.cost = instrumentPosition.cost.plus(event.params.premium);

  purchase.account = event.params.caller;
  purchase.underlying = event.params.underlying;
  purchase.optionType = event.params.optionType;
  purchase.amount = event.params.amount;
  purchase.premium = event.params.premium;
  purchase.optionID = event.params.optionID.toI32();
  purchase.save();
  instrumentPosition.save();
}
