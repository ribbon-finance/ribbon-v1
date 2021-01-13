require("dotenv").config();

(async function () {
  console.log(process.env.MAINNET_URI);
  process.exit();
})();
