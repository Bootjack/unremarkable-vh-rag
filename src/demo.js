import fs from "fs";
import OpenAI from "openai";
const openai = new OpenAI();

// Setup

let luxuryAssistant, luxuryFile, messages;

// Assistant

const assistantsPage = await openai.beta.assistants.list({ limit: "100" });

luxuryAssistant = assistantsPage.data.find((a) => a.name === "Luxury Apparel");

if (luxuryAssistant !== undefined) {
  console.log("🪲 Deleting assistant:", luxuryAssistant.id);
  await openai.beta.assistants.del(luxuryAssistant.id);
}

// File

const fileObjectsPage = await openai.files.list();

luxuryFile = fileObjectsPage.data.find(
  (f) => f.filename === "Luxury_Products_Apparel_Data.csv"
);

if (luxuryFile !== undefined) {
  console.log("🪲 Deleting file:", luxuryFile.id);
  await openai.files.del(luxuryFile.id);
}

// Assistant, Thread, Message

console.log("🪲 Creating file...");
luxuryFile = await openai.files.create({
  file: fs.createReadStream("data/Luxury_Products_Apparel_Data.csv"),
  purpose: "assistants",
});

console.log("🪲 Creating assistant...");
luxuryAssistant = await openai.beta.assistants.create({
  name: "Luxury Apparel",
  description: "Find or Analyze",
  instructions: "You can search and analyze the luxury apparel CSV data.",
  tools: [{ type: "code_interpreter" }],
  model: "gpt-4-turbo-preview",
  file_ids: [luxuryFile.id],
});

const countQuery = "how many products do you have";
console.log(`💬 ${countQuery}`);
const luxuryThread = await openai.beta.threads.create({
  messages: [
    {
      role: "user",
      content: countQuery,
    },
  ],
});

// Run, Steps

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(assistant, thread) {
  let run;
  let running = true;
  console.log("🪲 Running...");
  run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
  });
  while (running) {
    run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    await sleep(1000);
    if (!/^(queued|in_progress|cancelling)$/.test(run.status)) {
      running = false;
    }
  }
  // let runSteps = await openai.beta.threads.runs.steps.list(luxuryThread.id, run.id);
  // console.log(runSteps.data);
}

await run(luxuryAssistant, luxuryThread);
messages = await openai.beta.threads.messages.list(luxuryThread.id);
console.log(`🤖 ${messages.data[0].content[0].text.value}`);

// Diagram

const diagramQuery = "show me a diagram of the categories";
console.log(`💬 ${diagramQuery}`);
const diagramMessages = await openai.beta.threads.messages.create(
  luxuryThread.id,
  { role: "user", content: diagramQuery }
);

await run(luxuryAssistant, luxuryThread);
messages = await openai.beta.threads.messages.list(luxuryThread.id);
let fileID;
for (const content of messages.data[0].content) {
  if (content.type === "text") {
    console.log(`🤖 ${content.text.value}`);
  }
  if (content.type === "image_file") {
    fileID = content.image_file.file_id;
  }
}
if (fileID) {
  console.log("🪲 Get file content:", fileID);
  const file = await openai.files.retrieve(fileID);
  console.log(file);
  console.log("🪲 Downloading file:", fileID);
  const response = await openai.files.content(fileID);
  const writeStream = fs.createWriteStream("./images/diagram.png");
  response.body.pipe(writeStream);
}
