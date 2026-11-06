const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");

function getUsers() {
  return JSON.parse(localStorage.getItem("adr_users") || "[]");
}

function saveUsers(users) {
  localStorage.setItem("adr_users", JSON.stringify(users));
}

function setLoggedInUser(username) {
  localStorage.setItem("user", username);
}

function registerUser() {
  const username = document.getElementById("registerUsername")?.value.trim();
  const email = document.getElementById("registerEmail")?.value.trim();
  const password = document.getElementById("registerPassword")?.value.trim();
  const confirmPassword = document.getElementById("registerConfirmPassword")?.value.trim();
  const message = document.getElementById("registerMessage");

  if (!message) return;

  message.textContent = "";
  message.className = "auth-message";

  if (!username || !email || !password || !confirmPassword) {
    message.textContent = "Please fill all fields.";
    return;
  }

  if (password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }

  if (password.length < 4) {
    message.textContent = "Password must be at least 4 characters.";
    return;
  }

  const users = getUsers();
  const existingUser = users.find(user => user.username === username);

  if (existingUser) {
    message.textContent = "User already exists.";
    return;
  }

  users.push({ username, email, password });
  saveUsers(users);

  message.textContent = "Registered successfully. Redirecting to login...";
  message.classList.add("success");

  setTimeout(() => {
    window.location.href = "login.html";
  }, 1000);
}

function loginUser() {
  const username = document.getElementById("loginUsername")?.value.trim();
  const password = document.getElementById("loginPassword")?.value.trim();
  const message = document.getElementById("loginMessage");

  if (!message) return;

  message.textContent = "";
  message.className = "auth-message";

  if (!username || !password) {
    message.textContent = "Please enter username and password.";
    return;
  }

  const users = getUsers();
  const foundUser = users.find(
    user => user.username === username && user.password === password
  );

  if (!foundUser) {
    message.textContent = "Invalid username or password.";
    return;
  }

  setLoggedInUser(username);

  message.textContent = "Login successful. Redirecting...";
  message.classList.add("success");

  setTimeout(() => {
    window.location.href = "index.html";
  }, 800);
}

if (registerBtn) {
  registerBtn.addEventListener("click", registerUser);
}

if (loginBtn) {
  loginBtn.addEventListener("click", loginUser);
}