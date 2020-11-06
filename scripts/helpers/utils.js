module.exports = { sleep };

async function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
