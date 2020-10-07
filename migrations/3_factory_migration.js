var DataProvider = artifacts.require("DataProvider");
var Factory = artifacts.require("Factory");

module.exports = function (deployer) {
  // deployment steps
  deployer.deploy(DataProvider).then(function () {
    return deployer.deploy(Factory, DataProvider.address);
  });
};
