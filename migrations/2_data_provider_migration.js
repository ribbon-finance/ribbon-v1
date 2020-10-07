var DataProvider = artifacts.require("DataProvider");

module.exports = function (deployer) {
  // deployment steps
  deployer.deploy(DataProvider);
};
