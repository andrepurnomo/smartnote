document.addEventListener("DOMContentLoaded", () => {
  const todoForm = document.getElementById("todoForm");
  const todoInput = document.getElementById("todoInput");
  const todoList = document.getElementById("todoList");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeButtons = document.querySelectorAll(".close-modal");
  const saveSettingsBtn = document.getElementById("saveSettings");
  const togglePasswordBtn = document.querySelector(".toggle-password");
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const statusFilter = document.getElementById("statusFilter");
  const categoryFilter = document.getElementById("categoryFilter");

  // Load todos from localStorage
  let todos = JSON.parse(localStorage.getItem("todos")) || [];

  function saveTodos() {
    localStorage.setItem("todos", JSON.stringify(todos));
    updateCategoryFilter(); // Update category filter when todos change
    renderTodos();
  }

  todoInput.addEventListener("input", () => {
    const lines = todoInput.value.split("\n").length;
    const minRows = 4;
    const maxRows = 8;
    const newRows = Math.min(Math.max(lines, minRows), maxRows);
    todoInput.rows = newRows;
  });

  // Update the renderTodos function to use dynamic category colors
  function renderTodos() {
    todoList.innerHTML = "";
    const filteredTodos = filterTodos();
    const reversedTodos = [...filteredTodos].reverse();

    if (reversedTodos.length === 0) {
      todoList.innerHTML = `
          <div class="text-center text-muted p-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <p class="mt-2">No tasks found with current filters</p>
          </div>
        `;
      return;
    }

    reversedTodos.forEach((todo, index) => {
      const todoItem = document.createElement("div");
      todoItem.className = `todo-item ${
        todo.completed ? "completed" : ""
      } animate__animated animate__fadeIn`;

      // Create category badges with hover effect
      const categoryBadges = todo.categories
        .map((catName) => {
          const categoryObj =
            categories.find((c) => c.name === catName) || categories[0];
          return `<span class="category-badge" 
                      style="background-color: ${categoryObj.color}; 
                      transition: all 0.2s ease-in-out"
                      title="${catName}">${catName}</span>`;
        })
        .join("");

      todoItem.innerHTML = `
              <div class="todo-content">
                  <div class="todo-main d-flex align-items-center">
                      <div class="form-check flex-grow-1">
                          <input type="checkbox" class="form-check-input todo-checkbox" 
                              ${todo.completed ? "checked" : ""}>
                          <label class="form-check-label ${
                            todo.completed ? "text-muted" : ""
                          }">
                              ${todo.text}
                          </label>
                      </div>
                      <div class="todo-actions ms-3">
                          <button class="note-btn btn btn-light btn-sm me-2" title="Toggle note">
                              ${todo.note ? "📝" : "✏️"}
                          </button>
                          <button class="delete-btn btn btn-danger btn-sm" title="Delete task">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                              </svg>
                          </button>
                      </div>
                  </div>
                  <div class="category-badges-container mt-2">${categoryBadges}</div>
                  <div class="todo-note ${todo.note ? "has-note" : ""} mt-2">
                      <textarea class="note-input form-control" 
                          placeholder="Add a note...">${
                            todo.note || ""
                          }</textarea>
                  </div>
              </div>
          `;

      // Add smooth transitions and animations
      const checkbox = todoItem.querySelector(".todo-checkbox");
      checkbox.addEventListener("change", () => {
        todos[index].completed = checkbox.checked;
        todoItem.classList.add(
          "animate__animated",
          checkbox.checked ? "animate__fadeOut" : "animate__fadeIn"
        );
        setTimeout(() => {
          todoItem.classList.toggle("completed");
          saveTodos();
        }, 300);
      });

      const deleteBtn = todoItem.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", () => {
        todoItem.classList.add("animate__animated", "animate__fadeOutRight");
        setTimeout(() => {
          const originalIndex = todos.length - 1 - index;
          todos.splice(originalIndex, 1);
          renderTodos();
          saveTodos();
        }, 300);
      });

      const noteBtn = todoItem.querySelector(".note-btn");
      const noteInput = todoItem.querySelector(".note-input");
      const noteContainer = todoItem.querySelector(".todo-note");

      noteBtn.addEventListener("click", () => {
        noteContainer.classList.toggle("show");
        if (noteContainer.classList.contains("show")) {
          noteInput.focus();
        }
      });

      noteInput.addEventListener("input", () => {
        const originalIndex = todos.length - 1 - index;
        todos[originalIndex].note = noteInput.value.trim();
        noteBtn.innerHTML = noteInput.value.trim() ? "📝" : "✏️";
        saveTodos();
      });

      todoList.appendChild(todoItem);
    });
  }

  todoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = todoForm.querySelector(".submit-button");
    const buttonText = submitButton.querySelector(".button-text");

    submitButton.classList.add("loading");
    buttonText.style.display = "none";

    const noteText = todoInput.value.trim();

    if (noteText) {
      const existingCategories = categories.map((c) => c.name).join(", ");

      const prompt = `Given this note: "${noteText}", generate a short task title (max 6 words) and suggest 1-2 relevant categories that best describe this task. Try to use these existing categories if applicable: ${existingCategories}. Only suggest new categories if none of the existing ones fit well. Format response as JSON: {"title": "task title", "categories": ["category1", "category2"]}`;

      const aiResponse = await generateWithGemini(prompt);
      try {
        // Extract the JSON from the markdown-formatted text response
        const responseText = aiResponse.candidates[0].content.parts[0].text;
        const jsonStr = responseText.replace(/```json\n|\n```/g, "");
        const { title, categories: suggestedCategories } = JSON.parse(jsonStr);

        // Create new todo item
        const newTodo = {
          text: title,
          categories: suggestedCategories,
          completed: false,
          note: noteText,
        };

        // Add new categories if they don't exist
        suggestedCategories.forEach((categoryName) => {
          const normalizedName = categoryName.toLowerCase();
          if (!categories.find((c) => c.name === normalizedName)) {
            const randomColor =
              "#" + Math.floor(Math.random() * 16777215).toString(16);
            categories.push({
              name: normalizedName,
              color: randomColor,
            });
            saveCategories();
            renderCategories();
          }
        });

        todos.push(newTodo);
        todoInput.value = "";
        renderTodos();
        saveTodos();
      } catch (error) {
        console.error("Error parsing AI response:", error);
        alert("Error generating task. Please try again.");
      }
    }

    // Reset button state
    submitButton.classList.remove("loading");
    buttonText.style.display = "inline-flex";
  });

  // Initial render
  renderTodos();
  updateCategoryFilter();

  function updateCategoryFilter() {
    const storedCategories =
      JSON.parse(localStorage.getItem("categories")) || [];
    categoryFilter.innerHTML =
      '<option value="all">All Categories</option>' +
      storedCategories
        .map((cat) => `<option value="${cat.name}">${cat.name}</option>`)
        .join("");
  }

  function filterTodos() {
    const statusValue = statusFilter.value;
    const categoryValue = categoryFilter.value;

    return todos.filter((todo) => {
      const statusMatch =
        statusValue === "all"
          ? true
          : statusValue === "completed"
          ? todo.completed
          : !todo.completed;
      const categoryMatch =
        categoryValue === "all"
          ? true
          : todo.categories.includes(categoryValue);

      return statusMatch && categoryMatch;
    });
  }

  function filterTodos() {
    const statusValue = statusFilter.value;
    const categoryValue = categoryFilter.value;

    return todos.filter((todo) => {
      const statusMatch =
        statusValue === "all"
          ? true
          : statusValue === "completed"
          ? todo.completed
          : !todo.completed;
      const categoryMatch =
        categoryValue === "all"
          ? true
          : todo.categories.includes(categoryValue);

      return statusMatch && categoryMatch;
    });
  }

  // Load saved API key
  const savedApiKey = localStorage.getItem("geminiApiKey") || "";
  geminiApiKeyInput.value = savedApiKey;

  settingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      settingsModal.classList.add("hidden");
    });
  });

  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add("hidden");
    }
  });

  saveSettingsBtn.addEventListener("click", () => {
    const apiKey = geminiApiKeyInput.value.trim();
    localStorage.setItem("geminiApiKey", apiKey);
    settingsModal.classList.add("hidden");
  });

  togglePasswordBtn.addEventListener("click", () => {
    const type = geminiApiKeyInput.type === "password" ? "text" : "password";
    geminiApiKeyInput.type = type;
    togglePasswordBtn.textContent = type === "password" ? "👁️" : "🔒";
  });
  statusFilter.addEventListener("change", renderTodos);
  categoryFilter.addEventListener("change", renderTodos);

  // Function to interact with Gemini AI
  async function generateWithGemini(prompt) {
    const apiKey = localStorage.getItem("geminiApiKey");
    if (!apiKey) {
      alert("Please set your Gemini API key in settings");
      return null;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 1,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error calling Gemini AI:", error);
      alert(
        "Error connecting to Gemini AI. Please check your API key and try again."
      );
      return null;
    }
  }
});

// Add at the beginning of the DOMContentLoaded event listener
let categories = JSON.parse(localStorage.getItem("categories")) || [
  { name: "feature", color: "#0d6efd" },
  { name: "bug", color: "#dc3545" },
  { name: "refactor", color: "#198754" },
  { name: "docs", color: "#6c757d" },
  { name: "testing", color: "#ffc107" },
];

function saveCategories() {
  localStorage.setItem("categories", JSON.stringify(categories));
}

function renderCategories() {
  const categoriesList = document.getElementById("categoriesList");
  categoriesList.innerHTML = categories
    .map(
      (cat) => `
          <div class="category-item">
              <div class="d-flex align-items-center">
                  <div class="category-color" style="background-color: ${cat.color}"></div>
                  <span>${cat.name}</span>
              </div>
              <button class="remove-category" data-category="${cat.name}">×</button>
          </div>
      `
    )
    .join("");

  // Add event listeners for remove buttons
  document.querySelectorAll(".remove-category").forEach((btn) => {
    btn.addEventListener("click", () => {
      const categoryName = btn.dataset.category;
      if (categories.length > 1) {
        categories = categories.filter((c) => c.name !== categoryName);
        saveCategories();
        renderCategories();
      }
    });
  });
}

// Add in the settings modal section
document.getElementById("addCategoryBtn").addEventListener("click", () => {
  const nameInput = document.getElementById("newCategoryInput");
  const colorInput = document.getElementById("categoryColor");
  const name = nameInput.value.trim().toLowerCase();

  if (name && !categories.find((c) => c.name === name)) {
    categories.push({ name, color: colorInput.value });
    saveCategories();
    renderCategories();
    nameInput.value = "";
  }
});
// Call these functions at startup
renderCategories();

// Add after DOMContentLoaded event listener starts
// Update the Pickr configuration
const pickr = Pickr.create({
  el: "#color-picker-wrapper",
  theme: "classic",
  default: "#6c757d",
  components: {
    preview: true,
    opacity: true,
    hue: true,
    interaction: {
      hex: true,
      rgba: true,
      input: true,
      clear: true,
      save: true,
    },
  },
  swatches: ["#0d6efd", "#dc3545", "#198754", "#6c757d", "#ffc107", "#0dcaf0"],
});

pickr.on("save", (color) => {
  document.getElementById("categoryColor").value = color.toHEXA().toString();
});
