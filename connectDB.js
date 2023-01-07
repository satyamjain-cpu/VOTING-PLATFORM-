const Sequelize = require("sequelize");

const database = "todo_db";
const username = "satyam";
const password = "jain";
const sequelize = new Sequelize(database, username, password, {
  host: "localhost",
  dialect: "satyam",
});

const connect = async () => {
  return sequelize.authenticate();
};

module.exports = {
  connect,
  sequelize,
};
