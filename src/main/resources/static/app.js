const element = (id) => document.getElementById(id);
let token = "",
  roles = [],
  students = [],
  editing = null;
const isUserSection = () => roles.includes("ROLE_SUPER_ADMIN");
const canEdit = () => roles.includes("ROLE_ADMIN") || isUserSection();
const apiSection = () => (isUserSection() ? "users" : "student");
async function api(path, method = "GET", body) {
  const response = await fetch("/api/v1/" + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 401) {
      logout();
      throw Error("Войдите заново: сессия завершена или неверный пароль.");
    }
    if (response.status === 409)
      throw Error("Этот email уже используется. Укажите другой.");
    throw Error(
      response.status === 403
        ? "Нет доступа. Проверьте роль или данные входа."
        : "Ошибка сервера (" +
            response.status +
            "). Проверьте данные и повторите.",
    );
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function logout() {
  token = "";
  roles = [];
  students = [];
  element("rows").replaceChildren();
  element("editor").close();
  element("app").hidden = true;
  element("login").hidden = false;
  element("logout").hidden = true;
}
async function handleAction(fn) {
  element("status").textContent = "";
  try {
    await fn();
  } catch (e) {
    element("status").textContent = e.message;
  }
}
element("loginForm").onsubmit = (e) => {
  e.preventDefault();
  handleAction(async () => {
    const button = e.target.querySelector("button");
    button.disabled = true;
    try {
      const data = await api(
        "auth/login",
        "POST",
        Object.fromEntries(new FormData(e.target)),
      );
      token = data.token;
      roles = data.roles || [];
      element("search").value = "";
      e.target.reset();
      element("login").hidden = true;
      element("app").hidden = false;
      element("logout").hidden = false;
      element("add").hidden = !canEdit();
      element("account").textContent =
        "Роли: " + roles.map((r) => r.replace("ROLE_", "")).join(", ");
      element("listTitle").textContent = isUserSection()
        ? "Пользователи"
        : "Студенты";
      element("search").placeholder = isUserSection()
        ? "Поиск по email"
        : "Поиск по имени или фамилии";
      element("add").textContent = isUserSection()
        ? "Добавить пользователя"
        : "Добавить студента";
      await loadList();
    } finally {
      button.disabled = false;
    }
  });
};
async function loadList() {
  const data = await api(apiSection());
  students = data.response || data.responses || [];
  renderList();
}
function renderList() {
  const q = element("search").value.toLowerCase();
  const list = students.filter((s) =>
    (isUserSection() ? s.email : s.name + " " + s.surname)
      .toLowerCase()
      .includes(q),
  );
  const heads = document.querySelectorAll("thead th");
  heads[1].textContent = isUserSection() ? "Email" : "Имя";
  heads[2].textContent = isUserSection() ? "Роли" : "Фамилия";
  element("rows").replaceChildren();
  element("count").textContent =
    "Найдено: " + list.length + " / " + students.length;
  for (const s of list) {
    const tr = document.createElement("tr");
    for (const value of isUserSection()
      ? [s.id, s.email, (s.roles || []).join(", ")]
      : [s.id, s.name, s.surname]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    const td = document.createElement("td");
    const view = document.createElement("button");
    view.textContent = canEdit() ? "Открыть / изменить" : "Подробнее";
    view.onclick = () =>
      handleAction(async () =>
        openForm(isUserSection() ? s : await api("student/" + s.id)),
      );
    td.append(view);
    if (canEdit()) {
      const del = document.createElement("button");
      del.textContent = "Удалить";
      del.onclick = () => {
        if (
          confirm(
            "Удалить запись " + (s.email || s.name + " " + s.surname) + "?",
          )
        )
          handleAction(async () => {
            del.disabled = true;
            try {
              await api(apiSection() + "/" + s.id, "DELETE");
              await loadList();
            } finally {
              del.disabled = false;
            }
          });
      };
      td.append(del);
    }
    tr.append(td);
    element("rows").append(tr);
  }
  if (!list.length) {
    const tr = document.createElement("tr"),
      td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Записи не найдены";
    tr.append(td);
    element("rows").append(tr);
  }
}
function openForm(s = null) {
  editing = s;
  element("studentForm").reset();
  element("formError").textContent = "";
  element("formTitle").textContent = s ? "Карточка студента" : "Новый студент";
  for (const name of ["name", "surname", "phoneNumber", "email"]) {
    const field = element("studentForm").elements[name];
    field.value = s?.[name] || "";
    field.disabled = s
      ? !canEdit() || ["name", "surname"].includes(name)
      : false;
  }
  element("save").hidden = !canEdit();
  for (const id of ["nameLabel", "surnameLabel", "phoneLabel"])
    element(id).hidden = isUserSection();
  for (const name of ["name", "surname"])
    element("studentForm").elements[name].required = !isUserSection();
  element("studentForm").elements.email.required = isUserSection();
  element("passwordLabel").hidden = !isUserSection();
  element("rolesField").hidden = !isUserSection();
  element("studentForm").elements.password.required = isUserSection() && !s;
  for (const box of document.querySelectorAll('input[name="role"]'))
    box.checked = (s?.roles || []).includes(box.value);
  element("formTitle").textContent = isUserSection()
    ? s
      ? "Изменить пользователя"
      : "Новый пользователь"
    : s
      ? "Карточка студента"
      : "Новый студент";
  element("editor").showModal();
}
element("studentForm").onsubmit = async (e) => {
  e.preventDefault();
  element("save").disabled = true;
  element("formError").textContent = "";
  try {
    const f = e.target.elements;
    const body = {
      email: f.email.value.trim(),
      phoneNumber: f.phoneNumber.value.trim(),
    };
    if (isUserSection()) {
      const selected = [
        ...document.querySelectorAll('input[name="role"]:checked'),
      ].map((b) => b.value);
      if (!selected.length) throw Error("Выберите хотя бы одну роль");
      await api(
        editing ? "users/" + editing.id : "users/save",
        editing ? "PUT" : "POST",
        { email: body.email, password: f.password.value, roles: selected },
      );
    } else if (editing) await api("student/" + editing.id, "PUT", body);
    else
      await api("student/save", "POST", {
        name: f.name.value.trim(),
        surname: f.surname.value.trim(),
        email: body.email,
        phone_number: body.phoneNumber,
      });
    element("editor").close();
    await handleAction(loadList);
  } catch (e) {
    element("formError").textContent = e.message;
  } finally {
    element("save").disabled = false;
  }
};
element("add").onclick = () => openForm();
element("close").onclick = () => element("editor").close();
element("logout").onclick = logout;
element("refresh").onclick = () => handleAction(loadList);
element("search").oninput = renderList;
