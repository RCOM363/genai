const USER_MSG_STYLE = "my-6 bg-neutral-800 p-3 rounded-xl ml-auto max-w-fit";
const ASST_MSG_STYLE = "max-w-fit";

const chatCont = document.getElementById("chat-cont");
const input = document.getElementById("input");
const askBtn = document.getElementById("ask-btn");

const threadId = Date.now().toString(36) + Math.random().toString(36);

const loadingText = document.createElement("div");
loadingText.className = "my-6 animate-pulse";
loadingText.textContent = "Thinking...";

function addUserMsg(text) {
  const userMsg = document.createElement("div");

  userMsg.className = USER_MSG_STYLE;

  userMsg.textContent = text;

  chatCont?.appendChild(userMsg);

  input.value = "";
}

function addAsstMsg(text) {
  const asstMsg = document.createElement("div");

  asstMsg.className = ASST_MSG_STYLE;

  asstMsg.textContent = text;

  chatCont?.appendChild(asstMsg);
}

async function generate(text) {
  addUserMsg(text);
  chatCont?.appendChild(loadingText);
  const response = await fetch("http://localhost:5000/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ userMessage: text, threadId: threadId }),
  });

  if (!response.ok) {
    throw new Error("Error generating the response");
  }

  const jsonRes = await response.json();

  const { result } = jsonRes;
  loadingText.remove();
  addAsstMsg(result);
}

input.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    const text = input?.value.trim();
    if (!text) {
      return;
    }
    generate(text);
  }
});

askBtn.addEventListener("click", () => {
  const text = input?.value.trim();
  if (!text) {
    return;
  }
  generate(text);
});
