// NOTE Server - client architecture testing setup
const request = require("supertest");
// NOTE Used to parse markup language
const cheerio = require("cheerio");

const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  let $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

async function loginAsAdmin(agent, username, password) {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password,
    _csrf: csrfToken,
  });
}

async function loginAsVoter(agent, voterId, password, electionId) {
  let res = await agent.get(`/public/${electionId}`);
  let csrfToken = extractCsrfToken(res);
  res = await agent.post(`/session/${electionId}/voter`).send({
    voterId,
    password,
    electionId,
    _csrf: csrfToken,
  });
}

describe("User Test Suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ forced: true });
    server = app.listen(3000, () => {});
    // NOTE client agent for server
    agent = request.agent(server);
    await agent.get("/");
  });
  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("User A: Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("User A: Sign out", async () => {
    let res = await agent.get("/dashboard");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/dashboard");
    expect(res.statusCode).toBe(302);
  });

  test("User A: Creates a election and redirects back to dashboard", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain count
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    const count = elections.length;

    // NOTE Create new election
    const res = await agent.get("/dashboard");
    const csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "WC 2022: Trivia",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain latestCount
    electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    elections = JSON.parse(electionsResponse.text);
    const latestCount = elections.length;

    // NOTE Compare counts
    expect(latestCount).toBe(count + 1);
  });

  test("User A: Edit election name and redirects back to dashboard", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Create new election
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "Election",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain latest electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    const count = elections.length;

    // NOTE Update the created election
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.put(`/elections/${elections[count - 1].id}`).send({
      name: "Election update",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to check if changed
    electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    elections = JSON.parse(electionsResponse.text);

    // NOTE Compare the newly updated name
    expect(elections[count - 1].name).toBe("Election update");
  });

  test("User A: Delete a election and redirects back to dashboard", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Create new election
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "Delete me!",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain latest electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    const count = elections.length;

    // NOTE Update the created election
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.delete(`/elections/${elections[count - 1].id}`).send({
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to check if changed
    electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    elections = JSON.parse(electionsResponse.text);
    const latestCount = elections.length;

    // NOTE Compare the newly updated name
    expect(latestCount).toBe(count - 1);
  });

  test("User A: Create a question", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Create new election
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      name: "FIFA WC 2022: Trivia",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all questions to obtain count
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let count = JSON.parse(questionsResponse.text).length;

    // NOTE Create new question
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/questions`).send({
      title: "Who will win the world cup?",
      description: "Les Bleus vs La Albiceleste",
      _csrf: csrfToken,
    });

    // NOTE Fetch all questions to obtain latest count
    questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let latestCount = JSON.parse(questionsResponse.text).length;

    // NOTE Compare counts
    expect(latestCount).toBe(count + 1);
  });

  test("User A: Edit question title", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain latest electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all questions to obtain latest electionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;

    // NOTE Update the created question
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.put(`/elections/${eid}/questions/${qid}`).send({
      title: "Who will be world champs?",
      _csrf: csrfToken,
    });

    // NOTE Fetch all elections to check if changed
    questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    questions = JSON.parse(questionsResponse.text);

    // NOTE Compare the newly updated name
    expect(questions[questions.length - 1].title).toBe(
      "Who will be world champs?"
    );
  });

  test("User A: Delete a question", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Create new question
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/questions`).send({
      title: "Delete Title",
      description: "Delete Description",
      _csrf: csrfToken,
    });

    // NOTE Fetch all questions to obtain questionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;
    let count = questions.length;

    // NOTE Update the created question
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    res = await agent.delete(`/elections/${eid}/questions/${qid}`).send({
      _csrf: csrfToken,
    });

    // NOTE Fetch all questions to obtain latest count
    questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let latestCount = JSON.parse(questionsResponse.text).length;

    // NOTE Compare counts
    expect(latestCount).toBe(count - 1);
  });

  test("User A: Create a option", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all questions to obtain questionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;

    // NOTE Fetch all options to obtain count
    let optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    let options = JSON.parse(optionsResponse.text);
    let count = options.length;

    // NOTE Create new option
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/questions/${qid}/options`).send({
      title: "🇦🇷 Argentina",
      _csrf: csrfToken,
    });

    // NOTE Fetch all questions to obtain latest count
    optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    let latestCount = JSON.parse(optionsResponse.text).length;

    // NOTE Compare counts
    expect(latestCount).toBe(count + 1);
  });

  test("User A: Edit one option", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all questions to obtain questionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;

    // NOTE Create new option
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/questions/${qid}/options`).send({
      title: "France",
      _csrf: csrfToken,
    });

    // NOTE Fetch all options to obtain optionId
    let optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    let options = JSON.parse(optionsResponse.text);
    let oid = options[options.length - 1].id;

    // NOTE Edit option
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.put(`/elections/${eid}/questions/${qid}/options/${oid}`).send({
      title: "🇫🇷 France",
      _csrf: csrfToken,
    });

    // NOTE Fetch all questions to obtain latest count
    optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    options = JSON.parse(optionsResponse.text);

    // NOTE Compare the newly updated option
    expect(options[options.length - 1].title).toBe("🇫🇷 France");
  });

  test("User A: Delete one option", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all questions to obtain questionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;

    // NOTE Create new option
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/questions/${qid}/options`).send({
      title: "Morocco",
      _csrf: csrfToken,
    });

    // NOTE Fetch all options to obtain optionId
    let optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    let options = JSON.parse(optionsResponse.text);
    let oid = options[options.length - 1].id;
    let count = options.length;

    // NOTE Edit option
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent
      .delete(`/elections/${eid}/questions/${qid}/options/${oid}`)
      .send({
        _csrf: csrfToken,
      });

    // NOTE Fetch all questions to obtain latest count
    optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    options = JSON.parse(optionsResponse.text);
    let latestCount = options.length;

    expect(latestCount).toBe(count - 1);
  });

  test("User A: Create voter1", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all voters to obtain count
    let votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let count = JSON.parse(votersResponse.text).length;

    // NOTE Create new voter
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    res = await agent.post(`/elections/${eid}/voters`).send({
      voterId: "voter1",
      password: "voter1",
      _csrf: csrfToken,
    });

    // NOTE Fetch all voters to obtain latest count
    votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let latestCount = JSON.parse(votersResponse.text).length;

    // NOTE Compare counts
    expect(latestCount).toBe(count + 1);
  });

  test("User A: Create voter2", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all voters to obtain count
    let votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let count = JSON.parse(votersResponse.text).length;

    // NOTE Create new voter
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/voters`).send({
      voterId: "voter2",
      password: "voter2",
      _csrf: csrfToken,
    });

    // NOTE Fetch all voters to obtain latest count
    votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let latestCount = JSON.parse(votersResponse.text).length;

    // NOTE Compare counts
    expect(latestCount).toBe(count + 1);
  });

  test("User A: Delete a voter", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Create new voter
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${eid}/voters`).send({
      voterId: "voter3",
      password: "voter3",
      _csrf: csrfToken,
    });

    // NOTE Fetch all voters to obtain count
    let votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let voters = JSON.parse(votersResponse.text);
    let count = voters.length;
    let vid = voters[voters.length - 1].id;

    // NOTE Delete voter
    res = await agent.get("/dashboard");
    csrfToken = extractCsrfToken(res);
    await agent.delete(`/elections/${eid}/voters/${vid}`).send({
      _csrf: csrfToken,
    });

    // NOTE Fetch all voters to obtain latest count
    votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let latestCount = JSON.parse(votersResponse.text).length;

    // NOTE Compare counts
    expect(latestCount).toBe(count - 1);
  });

  test("User A: Launch election", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Try to access public page before launching
    electionsResponse = await agent.get(`/public/${eid}`);
    expect(electionsResponse.statusCode).toBe(403);

    // NOTE Launch election
    let res = await agent.get("/dashboard");
    let csrfToken = extractCsrfToken(res);
    res = await agent.put(`/elections/${eid}`).send({
      start: true,
      _csrf: csrfToken,
    });

    res = await agent.get(`/elections/${eid}`);

    // NOTE Try to access public page after launching
    electionsResponse = await agent.get(`/public/${eid}`);
    expect(electionsResponse.statusCode).toBe(200);
  });

  test("voter1: Vote", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all voters for given electionId
    let votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let voters = JSON.parse(votersResponse.text);

    // NOTE Fetch all questions for given electionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;

    // NOTE Fetch all options for given questionId
    let optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    let options = JSON.parse(optionsResponse.text);

    // NOTE Signout as Admin
    let res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);

    // NOTE Login as Voter
    const agent2 = request.agent(server);
    res = await loginAsVoter(agent2, "voter1", "voter1", eid);
    res = await agent2.get(`/public/${eid}/vote`);
    let csrfToken = extractCsrfToken(res);
    let sendRequest = {
      electionId: eid,
      voterId: voters[0].id,
      _csrf: csrfToken,
    };

    sendRequest["question-" + questions[0].id] = options[0].id;
    let voteResponse = await agent2
      .post(`/public/${eid}/cast`)
      .send(sendRequest);

    expect(voteResponse.statusCode).toBe(200);
  });

  test("voter2: Vote", async () => {
    // NOTE Login as Admin
    const agent = request.agent(server);
    await loginAsAdmin(agent, "user.a@test.com", "12345678");

    // NOTE Fetch all elections to obtain electionId
    let electionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    let elections = JSON.parse(electionsResponse.text);
    let eid = elections[elections.length - 1].id;

    // NOTE Fetch all voters for given electionId
    let votersResponse = await agent
      .get(`/elections/${eid}/voters`)
      .set("Accept", "application/json");
    let voters = JSON.parse(votersResponse.text);

    // NOTE Fetch all questions for given electionId
    let questionsResponse = await agent
      .get(`/elections/${eid}/questions`)
      .set("Accept", "application/json");
    let questions = JSON.parse(questionsResponse.text);
    let qid = questions[questions.length - 1].id;

    // NOTE Fetch all options for given questionId
    let optionsResponse = await agent
      .get(`/elections/${eid}/questions/${qid}/options`)
      .set("Accept", "application/json");
    let options = JSON.parse(optionsResponse.text);

    // NOTE Signout as Admin
    let res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);

    // NOTE Login as Voter
    const agent2 = request.agent(server);
    res = await loginAsVoter(agent2, "voter2", "voter2", eid);
    res = await agent2.get(`/public/${eid}/vote`);
    let csrfToken = extractCsrfToken(res);
    let sendRequest = {
      electionId: eid,
      voterId: voters[0].id,
      _csrf: csrfToken,
    };

    sendRequest["question-" + questions[0].id] = options[1].id;
    let voteResponse = await agent2
      .post(`/public/${eid}/cast`)
      .send(sendRequest);

    expect(voteResponse.statusCode).toBe(200);
  });
});
