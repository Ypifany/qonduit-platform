(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const stepNames = ["Your home", "Technology's contribution", "People and devices", "Outside support", "Version 1", "Version 2"];

  const choices = {
    home: [
      ["safe", "Give us a safe and stable place to live", "Safety and stability"],
      ["family", "Give my family a place to grow, learn, and spend time together", "Family life"],
      ["work", "Give me a private place to work and manage my life", "Work and daily life"],
      ["rest", "Give us a place to rest and recover", "Rest and recovery"],
      ["connection", "Help us stay connected to work, school, family, and services", "Connection"],
      ["independence", "Help the people here live with privacy and independence", "Privacy and independence"]
    ],
    uses: [
      ["work", "Work from home", "Email, meetings, files, employer systems"],
      ["school", "Learn or complete schoolwork", "Classes, assignments, school accounts"],
      ["communication", "Talk with family and friends", "Calls, messages, video chat"],
      ["entertainment", "Watch, play, or listen", "TV, games, music, exercise"],
      ["finance", "Shop and manage money", "Banking, bills, purchases"],
      ["smart", "Control things in the house", "Cameras, lights, locks, appliances"],
      ["storage", "Store photos and documents", "Cloud storage, backups, shared files"],
      ["health", "Use health or public services", "Appointments, benefits, exercise, records"]
    ],
    people: [
      ["me", "Me", "The person creating this map"],
      ["adults", "Other adults", "Partners, relatives, roommates"],
      ["children", "Children or teens", "Young people who live here"],
      ["guests", "Guests", "People who sometimes use the network"]
    ],
    devices: [
      ["router", "Wi-Fi router or gateway", "The box that provides internet or Wi-Fi"],
      ["work-laptop", "Work laptop", "A computer used for work"],
      ["personal-computer", "Personal computer", "Laptop or desktop"],
      ["phone", "Phones or tablets", "Mobile devices"],
      ["game", "Game console", "Xbox, PlayStation, Switch, or similar"],
      ["tv", "Smart TV or streaming device", "TV, Roku, Fire TV, or similar"],
      ["printer", "Printer", "Wired or wireless printer"],
      ["connected", "Connected home or exercise device", "Camera, speaker, Peloton, thermostat, or similar"]
    ],
    dependencies: [
      ["internet", "Internet service", "Verizon, Cox, Xfinity, or another provider"],
      ["electricity", "Electricity", "Power for the router and devices"],
      ["cell", "Cell service", "The mobile carrier used by phones"],
      ["apps", "Apps and online services", "Google, Microsoft, Zoom, streaming, banking, or other services"],
      ["work-systems", "Work systems", "VPN, company email, employer applications, or company sign-in"],
      ["school-systems", "School systems", "School portals, learning apps, and student accounts"],
      ["cloud", "Cloud storage or backup", "Online photos, documents, files, or device backup"],
      ["vendor", "Device company account or service", "Apple/iCloud, Samsung/SmartThings, Roku, Alexa, Google Home, HP Instant Ink, Peloton, or similar"]
    ]
  };

  const state = {
    step: 1,
    customDevices: [],
    customDependencies: [],
    mapV1: null,
    mapV2: null,
    mapQ: null,
    snapshotV1: null,
    snapshotV2: null,
    annotations: [],
    importedResponses: null,
    importedReflection: null,
    openedFromFile: false,
    projectCreatedAt: null,
    reveal: null,
    dirty: false,
    downloaded: false,
    activeMap: "v1",
    selected: { v1: null, v2: null, q: null },
    moveMode: { v1: false, v2: false, q: false },
    lastFocused: null,
    modalMode: "add"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const id = (prefix = "n") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const MAP_WIDTH = 1000;
  const NODE_WIDTH = 170;
  const NODE_HEIGHT = 70;

  function renderChoiceGroup(containerId, group, name) {
    const el = document.getElementById(containerId);
    el.innerHTML = choices[group].map(([value, label, help]) => `
      <label class="choice">
        <input type="checkbox" name="${name}" value="${esc(value)}">
        <span><strong>${esc(label)}</strong><small>${esc(help)}</small></span>
      </label>`).join("");
  }

  renderChoiceGroup("homePurposeChoices", "home", "homePurpose");
  renderChoiceGroup("techUseChoices", "uses", "techUse");
  renderChoiceGroup("peopleChoices", "people", "people");
  renderChoiceGroup("deviceChoices", "devices", "device");
  renderChoiceGroup("dependencyChoices", "dependencies", "dependency");

  function setJourneyStage(stage) {
    $$('[data-journey]').forEach(item=>item.classList.toggle("is-current",item.dataset.journey===stage));
  }
  setJourneyStage("build");

  $("#startExperience").addEventListener("click",()=>{
    $("#experienceOne").scrollIntoView({behavior:"smooth",block:"start"});
    $("#step1Title").setAttribute("tabindex","-1");
    $("#step1Title").focus({preventScroll:true});
  });
  $("#openSavedProject").addEventListener("click",()=>{
    $("#continueCard").open=true;
    $("#continueCard").scrollIntoView({behavior:"smooth",block:"center"});
    $("#projectFile").focus({preventScroll:true});
  });

  function checked(name) { return $$(`input[name="${name}"]:checked`).map(i => i.value); }
  function labelFor(group, value) { return choices[group].find(x => x[0] === value)?.[1] || value; }

  function naturalList(items) {
    const clean = items.filter(Boolean);
    if (!clean.length) return "";
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
    return `${clean.slice(0, -1).join(", ")}, and ${clean.at(-1)}`;
  }

  function updateHomeMission() {
    const area = $("#homeMission");
    if (area.dataset.touched === "true") return;
    const selected = checked("homePurpose").map(v => labelFor("home", v).replace(/^Give /, "give ").replace(/^Help /, "help "));
    const other = $("#homePurposeOther").value.trim();
    if (other) selected.push(other);
    area.value = selected.length ? `My home should ${naturalList(selected)}.` : "";
  }

  function updateTechMission() {
    const area = $("#techMission");
    if (area.dataset.touched === "true") return;
    const selected = checked("techUse").map(v => labelFor("uses", v).toLowerCase());
    const other = $("#techUseOther").value.trim();
    if (other) selected.push(other.toLowerCase());
    area.value = selected.length ? `Our home technology supports the people who live here by helping us ${naturalList(selected)}.` : "";
  }

  $$("input[name='homePurpose']").forEach(i => i.addEventListener("change", updateHomeMission));
  $$("input[name='techUse']").forEach(i => i.addEventListener("change", updateTechMission));
  $("#homePurposeOther").addEventListener("input", updateHomeMission);
  $("#techUseOther").addEventListener("input", updateTechMission);
  $("#homeMission").addEventListener("input", e => e.target.dataset.touched = "true");
  $("#techMission").addEventListener("input", e => e.target.dataset.touched = "true");

  function renderTags(kind) {
    const list = kind === "device" ? state.customDevices : state.customDependencies;
    const target = kind === "device" ? $("#customDevices") : $("#customDependencies");
    target.innerHTML = list.map((text, index) => `<span class="selected-tag">${esc(text)}<button type="button" data-remove-${kind}="${index}" aria-label="Remove ${esc(text)}">×</button></span>`).join("");
  }

  function addTag(kind) {
    const input = kind === "device" ? $("#deviceInput") : $("#dependencyInput");
    const value = input.value.trim();
    if (!value) return;
    const list = kind === "device" ? state.customDevices : state.customDependencies;
    if (!list.some(x => x.toLowerCase() === value.toLowerCase())) list.push(value);
    input.value = "";
    renderTags(kind);
    state.dirty = true;
  }

  $("#addDevice").addEventListener("click", () => addTag("device"));
  $("#addDependency").addEventListener("click", () => addTag("dependency"));
  $("#deviceInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTag("device"); }});
  $("#dependencyInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTag("dependency"); }});
  document.addEventListener("click", e => {
    const d = e.target.closest("[data-remove-device]");
    const x = e.target.closest("[data-remove-dependency]");
    if (d) { state.customDevices.splice(Number(d.dataset.removeDevice), 1); renderTags("device"); }
    if (x) { state.customDependencies.splice(Number(x.dataset.removeDependency), 1); renderTags("dependency"); }
  });

  function setStep(number) {
    state.step = number;
    $$(".step").forEach(s => s.classList.toggle("active", Number(s.dataset.step) === number));
    $("#stepLabel").textContent = `Home map · Step ${number} of 6`;
    $("#stepName").textContent = stepNames[number - 1];
    $("#progressBar").style.width = `${number / 6 * 100}%`;
    $("#experience").scrollIntoView({behavior: "smooth", block: "start"});
    const title = $(`.step[data-step="${number}"] h2`);
    if (title) title.setAttribute("tabindex", "-1"), title.focus({preventScroll: true});
    if(number<=4)setJourneyStage("build");
    else if(number===5)setJourneyStage("notice");
    else setJourneyStage("discover");
  }

  function validateStep(step) {
    const errors = [];
    if (step === 1 && !$("#homeMission").value.trim()) errors.push("Choose an example or write a home statement before continuing.");
    if (step === 2 && !$("#techMission").value.trim()) errors.push("Choose a technology use or write a technology statement before continuing.");
    if (step === 3 && checked("people").length === 0) errors.push("Choose at least one group of people who uses the technology.");
    if (step === 3 && checked("device").length + state.customDevices.length === 0) errors.push("Choose or add at least one device.");
    if (step === 4 && checked("dependency").length + state.customDependencies.length === 0) errors.push("Choose or add at least one outside service or dependency.");
    const target = $(`#validation${step}`);
    if (target) target.textContent = errors.join(" ");
    return errors.length === 0;
  }

  document.addEventListener("click", e => {
    const next = e.target.closest("[data-next]");
    const back = e.target.closest("[data-back]");
    if (next) {
      const current = Number(next.closest(".step").dataset.step);
      if (validateStep(current)) { state.dirty = true; setStep(Number(next.dataset.next)); }
    }
    if (back) setStep(Number(back.dataset.back));
  });

  function responseData() {
    return {
      homeMission: $("#homeMission").value.trim(),
      techMission: $("#techMission").value.trim(),
      homePurposes: checked("homePurpose").map(v => labelFor("home", v)).concat($("#homePurposeOther").value.trim()).filter(Boolean),
      techUses: checked("techUse").map(v => ({key: v, label: labelFor("uses", v)})).concat($("#techUseOther").value.trim() ? [{key:"custom", label:$("#techUseOther").value.trim()}] : []),
      people: checked("people").map(v => labelFor("people", v)),
      devices: checked("device").map(v => ({key: v, label: labelFor("devices", v)})).concat(state.customDevices.map(label => ({key:"custom", label}))),
      dependencies: checked("dependency").map(v => ({key: v, label: labelFor("dependencies", v)})).concat(state.customDependencies.map(label => ({key:"custom", label})))
    };
  }

  function makeNode(label, type, detail = "", certainty = "known", x = 100, y = 100, extra = {}) {
    return { id: id("node"), label, type, detail, certainty, x, y, ...extra };
  }
  function makeEdge(from, to, label, extra = {}) { return { id: id("edge"), from, to, label, ...extra }; }

  function buildStartingMap() {
    if (!validateStep(4)) return;
    const data = responseData();
    const nodes = [];
    const edges = [];
    const home = makeNode("Home mission", "purpose", data.homeMission, "known", 375, 40, {role:"home"});
    const tech = makeNode("Home technology system", "system", data.techMission, "known", 375, 155, {role:"tech"});
    nodes.push(home, tech);
    edges.push(makeEdge(tech.id, home.id, "supports"));

    data.techUses.forEach((item, i) => {
      const node = makeNode(item.label, "purpose", "A use supported by home technology", "known", 80 + (i % 4) * 205, 280 + Math.floor(i / 4) * 80);
      nodes.push(node); edges.push(makeEdge(tech.id, node.id, "makes possible"));
    });
    data.people.forEach((label, i) => {
      const node = makeNode(label, "person", "Uses or is affected by the home technology system", "known", 30 + i * 205, 390);
      nodes.push(node); edges.push(makeEdge(node.id, tech.id, "uses"));
    });
    data.devices.forEach((item, i) => {
      const node = makeNode(item.label, "device", "A device or piece of equipment in the home system", "known", 45 + (i % 5) * 170, 485 + Math.floor(i / 5) * 75, {key:item.key});
      nodes.push(node); edges.push(makeEdge(node.id, tech.id, item.key === "router" ? "provides connection" : "connects through"));
    });
    data.dependencies.forEach((item, i) => {
      const node = makeNode(item.label, "service", "Something outside the home that the system relies on", "known", 45 + (i % 5) * 170, 590 + Math.floor(i / 5) * 75, {key:item.key});
      nodes.push(node); edges.push(makeEdge(tech.id, node.id, "relies on"));
    });
    state.mapV1 = {nodes, edges};
    state.projectCreatedAt = state.projectCreatedAt || new Date().toISOString();
    state.activeMap = "v1";
    state.selected.v1 = tech.id;
    state.dirty = true;
    setStep(5);
    arrangeMap("v1");
    renderMap("v1");
  }
  $("#buildMap").addEventListener("click", buildStartingMap);

  const typeStyle = {
    purpose: {fill:"#eaf4ff", stroke:"#185fa5"},
    system: {fill:"#042c53", stroke:"#378add", text:"#ffffff"},
    person: {fill:"#edf8f3", stroke:"#0f6e56"},
    device: {fill:"#f2f0ff", stroke:"#6f62b5"},
    service: {fill:"#fff6e6", stroke:"#9a5b08"}
  };

  function mapRefs(which) {
    const config = {
      v1: {map:"mapV1", svg:"#mapCanvas", nodeLayer:"#nodeLayer", edgeLayer:"#edgeLayer", nodeList:"#nodeList", edgeList:"#edgeList", editButton:"#editNodeBtn", help:"#selectedHelp"},
      v2: {map:"mapV2", svg:"#mapCanvasV2", nodeLayer:"#nodeLayerV2", edgeLayer:"#edgeLayerV2", nodeList:"#nodeListV2", edgeList:"#edgeListV2", editButton:"#editNodeBtnV2", help:"#selectedHelpV2"},
      q: {map:"mapQ", svg:"#mapCanvasQ", nodeLayer:"#nodeLayerQ", edgeLayer:"#edgeLayerQ", nodeList:"#nodeListQ", edgeList:"#edgeListQ", editButton:null, help:"#selectedHelpQ"}
    }[which];
    return {
      map: state[config.map],
      svg: $(config.svg),
      nodeLayer: $(config.nodeLayer),
      edgeLayer: $(config.edgeLayer),
      nodeList: $(config.nodeList),
      edgeList: $(config.edgeList),
      editButton: config.editButton ? $(config.editButton) : null,
      help: $(config.help)
    };
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    return el;
  }

  function wrapLabel(label, max = 20) {
    const words = label.split(/\s+/); const lines = [""];
    words.forEach(word => {
      const last = lines.length - 1;
      if ((lines[last] + " " + word).trim().length <= max || lines.length === 3) lines[last] = (lines[last] + " " + word).trim();
      else lines.push(word);
    });
    return lines.slice(0,3);
  }

  function renderMap(which) {
    const refs = mapRefs(which); if (!refs.map) return;
    const viewHeight = refs.map.viewHeight || 720;
    refs.svg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${viewHeight}`);
    const renderedWidth = window.matchMedia("(max-width: 760px)").matches ? 820 : refs.svg.parentElement.clientWidth;
    refs.svg.style.height = `${Math.max(refs.svg.parentElement.clientHeight, Math.round(renderedWidth * viewHeight / MAP_WIDTH))}px`;
    refs.edgeLayer.innerHTML = ""; refs.nodeLayer.innerHTML = "";
    const selected = state.selected[which];
    const relatedEdges = selected ? refs.map.edges.filter(edge => edge.from === selected || edge.to === selected) : [];
    const relatedRelationshipWords = new Set(relatedEdges.map(edge=>edge.label));
    const showLabelsOnMap = relatedEdges.length > 0 && relatedRelationshipWords.size <= 6;
    const shownRelationshipLabels = new Set();
    refs.map.edges.forEach(edge => {
      const a = refs.map.nodes.find(n => n.id === edge.from); const b = refs.map.nodes.find(n => n.id === edge.to);
      if (!a || !b) return;
      const related = selected && (edge.from === selected || edge.to === selected);
      const dimmed = selected && !related;
      const annotationCount = which === "q" ? state.annotations.filter(item => item.targetType === "edge" && item.targetId === edge.id).length : 0;
      const line = svgEl("line", {x1:a.x + NODE_WIDTH / 2, y1:a.y + NODE_HEIGHT / 2, x2:b.x + NODE_WIDTH / 2, y2:b.y + NODE_HEIGHT / 2, class:`svg-edge${edge.addedV2 ? " new" : ""}${annotationCount ? " annotated" : ""}${related ? " active" : ""}${dimmed ? " dimmed" : ""}`});
      refs.edgeLayer.append(line);
      if (annotationCount) {
        const badgeX=(a.x+b.x+NODE_WIDTH)/2, badgeY=(a.y+b.y+NODE_HEIGHT)/2;
        const badge=svgEl("circle",{cx:String(badgeX),cy:String(badgeY),r:"13",class:"annotation-badge","aria-hidden":"true"});
        const badgeText=svgEl("text",{x:String(badgeX),y:String(badgeY+4),class:"annotation-badge-text","text-anchor":"middle","aria-hidden":"true"});
        badgeText.textContent=String(annotationCount); refs.edgeLayer.append(badge,badgeText);
      }
      const showRelationshipLabel = showLabelsOnMap && related && !shownRelationshipLabels.has(edge.label);
      if (showRelationshipLabel) {
        shownRelationshipLabels.add(edge.label);
        const selectedNode = a.id === selected ? a : b;
        const otherNode = a.id === selected ? b : a;
        const sx = selectedNode.x + NODE_WIDTH / 2, sy = selectedNode.y + NODE_HEIGHT / 2;
        const ox = otherNode.x + NODE_WIDTH / 2, oy = otherNode.y + NODE_HEIGHT / 2;
        const dx = ox - sx, dy = oy - sy, distance = Math.hypot(dx, dy) || 1;
        const labelX = sx + dx / distance * 58;
        const labelY = sy + dy / distance * 58;
        const labelWidth = Math.max(88, edge.label.length * 9 + 24);
        const bg = svgEl("rect", {x:String(labelX-labelWidth/2), y:String(labelY-17), width:String(labelWidth), height:"34", rx:"17", class:"edge-label-bg active", "aria-hidden":"true"});
        const text = svgEl("text", {x:String(labelX), y:String(labelY+5), class:"edge-label active", "text-anchor":"middle", "aria-hidden":"true"});
        text.textContent = edge.label; refs.edgeLayer.append(bg, text);
      }
    });
    refs.map.nodes.forEach(node => {
      const style = typeStyle[node.type] || typeStyle.device;
      const isDimmed = selected && selected !== node.id && !refs.map.edges.some(edge => (edge.from === selected && edge.to === node.id) || (edge.to === selected && edge.from === node.id));
      const nodeAnnotationCount=which==="q"?state.annotations.filter(item=>item.targetType==="node"&&item.targetId===node.id).length:0;
      const annotationLabel=nodeAnnotationCount?` ${nodeAnnotationCount} attached ${nodeAnnotationCount===1?"item":"items"}.`:"";
      const g = svgEl("g", {transform:`translate(${node.x} ${node.y})`, class:`node-group${selected === node.id ? " selected" : ""}${isDimmed ? " dimmed" : ""}${node.addedV2 ? " added-v2" : ""}`, tabindex:"0", role:"button", "aria-label":`${node.label}. ${node.type}. ${node.certainty}. ${node.detail || ""}.${annotationLabel}`, "data-node-id":node.id});
      const rect = svgEl("rect", {width:String(NODE_WIDTH), height:String(NODE_HEIGHT), rx:"13", fill:style.fill, stroke:style.stroke, class:"node-shape"});
      if (node.certainty !== "known") rect.setAttribute("stroke-dasharray", node.certainty === "assumed" ? "7 5" : "3 4");
      const title = svgEl("title"); title.textContent = `${node.label}: ${node.detail || node.type} (${node.certainty})`; g.append(title, rect);
      wrapLabel(node.label, 22).forEach((line, i, arr) => {
        const t = svgEl("text", {x:String(NODE_WIDTH / 2), y:String(36 - (arr.length-1)*9 + i*18), "text-anchor":"middle", style:`fill:${style.text || "#172433"}`}); t.textContent = line; g.append(t);
      });
      if (which === "q") {
        if(nodeAnnotationCount){
          const badge=svgEl("circle",{cx:String(NODE_WIDTH-8),cy:"8",r:"14",class:"annotation-badge","aria-hidden":"true"});
          const badgeText=svgEl("text",{x:String(NODE_WIDTH-8),y:"12",class:"annotation-badge-text","text-anchor":"middle","aria-hidden":"true"});
          badgeText.textContent=String(nodeAnnotationCount); g.append(badge,badgeText);
        }
      }
      addNodeInteractions(g, node, which);
      refs.nodeLayer.append(g);
    });
    renderOutline(which);
    if (refs.editButton) refs.editButton.disabled = !selected;
  }

  function addNodeInteractions(group, node, which) {
    let dragging = false; let offset = {x:0,y:0};
    group.addEventListener("pointerdown", e => {
      state.selected[which] = node.id; state.activeMap = which;
      const touchLike=e.pointerType==="touch"||e.pointerType==="pen"||window.matchMedia("(max-width: 760px)").matches;
      if(touchLike&&!state.moveMode[which])return;
      e.preventDefault();
      dragging = true;
      const p = clientToSvg(e, mapRefs(which).svg); offset = {x:p.x-node.x, y:p.y-node.y};
      group.classList.add("selected");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, {once:true});
    });
    group.addEventListener("click",()=>{
      if(dragging)return;
      state.selected[which]=node.id;state.activeMap=which;renderMap(which);
      if(which==="q")selectQuestionTarget(`node:${node.id}`);
    });
    function move(e) {
      if (!dragging) return;
      const p = clientToSvg(e, mapRefs(which).svg);
      const bounds = mapRefs(which).svg.viewBox.baseVal;
      node.x = Math.max(0, Math.min(bounds.width - NODE_WIDTH, p.x-offset.x)); node.y = Math.max(0, Math.min(bounds.height - NODE_HEIGHT, p.y-offset.y));
      state.dirty = true; renderMap(which);
    }
    function stop() { dragging = false; window.removeEventListener("pointermove", move); renderMap(which); if(which==="q")selectQuestionTarget(`node:${node.id}`); }
    group.addEventListener("dblclick", () => {
      if(which==="q") openAnnotationModal(`node:${node.id}`);
      else openNodeModal(which, "edit", node.id);
    });
    group.addEventListener("keydown", e => {
      if (["Enter"," "].includes(e.key)) {
        e.preventDefault(); state.selected[which] = node.id; renderMap(which);
        if (which === "q") selectQuestionTarget(`node:${node.id}`);
        else openNodeModal(which,"edit",node.id);
        return;
      }
      const amount = e.shiftKey ? 20 : 6;
      if (e.key === "ArrowLeft") node.x -= amount;
      else if (e.key === "ArrowRight") node.x += amount;
      else if (e.key === "ArrowUp") node.y -= amount;
      else if (e.key === "ArrowDown") node.y += amount;
      else return;
      const bounds = mapRefs(which).svg.viewBox.baseVal;
      e.preventDefault(); node.x=Math.max(0,Math.min(bounds.width-NODE_WIDTH,node.x)); node.y=Math.max(0,Math.min(bounds.height-NODE_HEIGHT,node.y)); state.dirty=true; renderMap(which);
    });
  }

  function clientToSvg(event, svg) {
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function centerNodeInCanvas(which, nodeId) {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const refs = mapRefs(which);
    const node = refs.map?.nodes.find(item => item.id === nodeId);
    const canvas = refs.svg?.parentElement;
    if (!node || !canvas) return;
    const scale = refs.svg.clientWidth / refs.svg.viewBox.baseVal.width;
    const left = (node.x + NODE_WIDTH / 2) * scale - canvas.clientWidth / 2;
    const top = (node.y + NODE_HEIGHT / 2) * scale - canvas.clientHeight / 2;
    canvas.scrollTo({left:Math.max(0,left), top:Math.max(0,top), behavior:"smooth"});
  }

  function renderOutline(which) {
    const refs = mapRefs(which); if (!refs.map) return;
    const selected = state.selected[which];
    refs.nodeList.innerHTML = refs.map.nodes.map(n => {
      const status = n.certainty === "known" ? "Known" : n.certainty === "assumed" ? "Assumed" : "Need to check";
      const count=which==="q"?state.annotations.filter(item=>item.targetType==="node"&&item.targetId===n.id).length:0;
      const remove=which==="q"?"":`<button class="node-delete" type="button" data-delete-node="${n.id}" data-map="${which}" aria-label="Delete ${esc(n.label)}">×</button>`;
      return `<li class="${selected === n.id ? "is-selected" : ""}${which==="q"?" question-node-item":""}"><button class="node-select" type="button" data-select-node="${n.id}" data-map="${which}" aria-pressed="${selected === n.id}"><strong>${esc(n.label)}</strong><small>${esc(status)}${count?` · ${count} attached`:""}</small></button>${remove}</li>`;
    }).join("");
    refs.edgeList.innerHTML = refs.map.edges.map(edge => {
      const a=refs.map.nodes.find(n=>n.id===edge.from), b=refs.map.nodes.find(n=>n.id===edge.to);
      if(which==="q"){
        const count=state.annotations.filter(item=>item.targetType==="edge"&&item.targetId===edge.id).length;
        return `<li><span>${esc(a?.label || "Missing")} <strong>${esc(edge.label)}</strong> ${esc(b?.label || "Missing")}${count?` · ${count} attached`:""}</span><button type="button" data-annotate-edge="${edge.id}">Question</button></li>`;
      }
      return `<li><button type="button" data-delete-edge="${edge.id}" data-map="${which}" aria-label="Delete relationship">×</button>${esc(a?.label || "Missing")} <strong>${esc(edge.label)}</strong> ${esc(b?.label || "Missing")}</li>`;
    }).join("") || "<li>No relationships yet.</li>";
    const selectedNode = refs.map.nodes.find(n => n.id === selected);
    const relationshipWords = [...new Set(refs.map.edges.filter(edge => edge.from === selected || edge.to === selected).map(edge => edge.label))];
    const help = refs.help;
    if (help) help.textContent = selectedNode ? `${selectedNode.label} is highlighted. Direct relationships: ${relationshipWords.join(", ") || "none yet"}.` : "Select a box on the map or use a button in the outline.";
    if(which==="q") renderAnnotations();
  }

  function questionTargetOptions() {
    if(!state.mapQ) return "";
    const nodes=state.mapQ.nodes.map(node=>`<option value="node:${node.id}">Box: ${esc(node.label)}</option>`).join("");
    const edges=state.mapQ.edges.map(edge=>{
      const a=state.mapQ.nodes.find(n=>n.id===edge.from),b=state.mapQ.nodes.find(n=>n.id===edge.to);
      return `<option value="edge:${edge.id}">Relationship: ${esc(a?.label||"Missing")} ${esc(edge.label)} ${esc(b?.label||"Missing")}</option>`;
    }).join("");
    return `<option value="">Choose a box or relationship</option><optgroup label="Boxes">${nodes}</optgroup><optgroup label="Relationships">${edges}</optgroup>`;
  }

  function targetInfo(value) {
    const [targetType,targetId]=String(value||"").split(":");
    if(targetType==="node"){
      const node=state.mapQ?.nodes.find(item=>item.id===targetId);
      return node?{targetType,targetId,label:node.label,node}:null;
    }
    if(targetType==="edge"){
      const edge=state.mapQ?.edges.find(item=>item.id===targetId);
      if(!edge)return null;
      const a=state.mapQ.nodes.find(n=>n.id===edge.from),b=state.mapQ.nodes.find(n=>n.id===edge.to);
      return {targetType,targetId,label:`${a?.label||"Missing"} ${edge.label} ${b?.label||"Missing"}`,edge};
    }
    return null;
  }

  function promptForTarget(value) {
    const info=targetInfo(value);
    if(!info)return "Choose a map item to see a useful question.";
    if(info.targetType==="edge")return `How do you know that “${info.label}” is true? What evidence supports this relationship?`;
    if(info.node.certainty==="assumed")return `What are you assuming about ${info.label}, and what would help you verify it?`;
    if(info.node.certainty==="check")return `What would you need to learn before you could explain ${info.label} with confidence?`;
    if(info.node.type==="service")return `What does ${info.label} provide, who controls it, and what happens if it is unavailable?`;
    if(info.node.type==="person")return `How does ${info.label} use or depend on this system? What might the map be missing?`;
    return `What do you know about ${info.label}, what are you assuming, and what would you like to understand better?`;
  }

  function promptForAnnotation(value,type) {
    const info=targetInfo(value);
    if(!info)return "Choose a map item before writing.";
    if(type==="assumption")return `What are you currently treating as true about ${info.label} without confirming it?`;
    if(type==="uncertainty")return `What about ${info.label} do you still need to verify or understand?`;
    if(type==="evidence")return `What did you observe, read, or confirm that supports what the map says about ${info.label}?`;
    if(type==="note")return `What discovery or useful detail about ${info.label} should remain with this map?`;
    return promptForTarget(value);
  }

  function populateAnnotationTargets(selectedValue="") {
    const options=questionTargetOptions();
    $("#annotationTarget").innerHTML=options;
    $("#annotationModalTarget").innerHTML=options;
    if(selectedValue){$("#annotationTarget").value=selectedValue;$("#annotationModalTarget").value=selectedValue;}
    $("#questionPrompt").textContent=promptForTarget($("#annotationTarget").value);
    $("#annotationSuggestion").textContent=promptForAnnotation($("#annotationModalTarget").value,$("#annotationType").value);
  }

  function selectQuestionTarget(value) {
    if(!state.mapQ)return;
    if(!$("#annotationTarget").options.length)populateAnnotationTargets(value);
    else $("#annotationTarget").value=value;
    const info=targetInfo(value);
    if(info?.targetType==="node")state.selected.q=info.targetId;
    $("#questionPrompt").textContent=promptForTarget(value);
  }

  function renderAnnotations() {
    if(!state.mapQ)return;
    const typeLabels={question:"Question",assumption:"Assumption",uncertainty:"Need to verify",evidence:"Evidence",note:"Note or discovery"};
    $("#annotationCount").textContent=`(${state.annotations.length})`;
    $("#annotationList").innerHTML=state.annotations.length?state.annotations.map(item=>{
      const info=targetInfo(`${item.targetType}:${item.targetId}`);
      return `<li><span class="annotation-type">${esc(typeLabels[item.type]||item.type)}</span><strong>${esc(info?.label||"Map item")}</strong><span>${esc(item.text)}</span><button type="button" data-delete-annotation="${item.id}">Remove</button></li>`;
    }).join(""):"<li class=\"empty-note\">Nothing attached yet.</li>";
  }

  function openAnnotationModal(targetValue="") {
    populateAnnotationTargets(targetValue||$("#annotationTarget").value);
    $("#annotationType").value="question";
    $("#annotationText").value="";
    $("#annotationValidation").textContent="";
    $("#annotationSuggestion").textContent=promptForAnnotation($("#annotationModalTarget").value,$("#annotationType").value);
    openModal($("#annotationModal"));
  }

  document.addEventListener("click", e => {
    const select = e.target.closest("[data-select-node]");
    const delNode = e.target.closest("[data-delete-node]");
    const delEdge = e.target.closest("[data-delete-edge]");
    const panelTop = e.target.closest("[data-panel-top]");
    const panelOutline = e.target.closest("[data-panel-outline]");
    const annotateEdge = e.target.closest("[data-annotate-edge]");
    const deleteAnnotation = e.target.closest("[data-delete-annotation]");
    if (panelTop) {
      const panel = document.getElementById(panelTop.dataset.panelTop);
      if(window.matchMedia("(max-width: 760px)").matches)panel?.scrollIntoView({behavior:"smooth",block:"start"});
      else panel?.scrollTo({top:0,behavior:"auto"});
    }
    if (panelOutline) {
      const outline = document.getElementById(panelOutline.dataset.panelOutline);
      if (outline) {
        outline.open = true;
        const panel = outline.closest(".map-panel");
        if(window.matchMedia("(max-width: 760px)").matches)outline.scrollIntoView({behavior:"smooth",block:"start"});
        else panel?.scrollTo({top:Math.max(0, outline.offsetTop - 64), behavior:"auto"});
        outline.querySelector("summary")?.focus({preventScroll:true});
      }
    }
    if (select) {
      state.selected[select.dataset.map] = select.dataset.selectNode;
      state.activeMap=select.dataset.map;
      renderMap(select.dataset.map);
      if(select.dataset.map==="q") selectQuestionTarget(`node:${select.dataset.selectNode}`);
      requestAnimationFrame(() => centerNodeInCanvas(select.dataset.map, select.dataset.selectNode));
    }
    if(annotateEdge) openAnnotationModal(`edge:${annotateEdge.dataset.annotateEdge}`);
    if(deleteAnnotation){
      const index=state.annotations.findIndex(item=>item.id===deleteAnnotation.dataset.deleteAnnotation);
      const removed=state.annotations[index];
      state.annotations.splice(index,1);state.dirty=true;renderMap("q");
      showUndo("Question or note removed.",()=>{state.annotations.splice(index,0,removed);renderMap("q");});
    }
    if (delNode) {
      const refs=mapRefs(delNode.dataset.map), nodeId=delNode.dataset.deleteNode;
      const nodeIndex=refs.map.nodes.findIndex(n=>n.id===nodeId),removedNode=refs.map.nodes[nodeIndex];
      const removedEdges=refs.map.edges.filter(x=>x.from===nodeId||x.to===nodeId);
      refs.map.nodes.splice(nodeIndex,1);refs.map.edges=refs.map.edges.filter(x=>x.from!==nodeId&&x.to!==nodeId);state.selected[delNode.dataset.map]=null;state.dirty=true;renderMap(delNode.dataset.map);
      showUndo(`${removedNode.label} and its relationships were removed.`,()=>{refs.map.nodes.splice(nodeIndex,0,removedNode);refs.map.edges.push(...removedEdges);renderMap(delNode.dataset.map);});
    }
    if (delEdge) { const refs=mapRefs(delEdge.dataset.map),edgeIndex=refs.map.edges.findIndex(x=>x.id===delEdge.dataset.deleteEdge),removedEdge=refs.map.edges[edgeIndex];refs.map.edges.splice(edgeIndex,1);state.dirty=true;renderMap(delEdge.dataset.map);showUndo("Relationship removed.",()=>{refs.map.edges.splice(edgeIndex,0,removedEdge);renderMap(delEdge.dataset.map);}); }
  });

  $$('[data-move-mode]').forEach(button=>button.addEventListener("click",()=>{
    const which=button.dataset.moveMode;state.moveMode[which]=!state.moveMode[which];
    button.setAttribute("aria-pressed",String(state.moveMode[which]));
    button.textContent=`Move boxes: ${state.moveMode[which]?"on":"off"}`;
    showStatus(state.moveMode[which]?"Move boxes is on. Drag a box to move it.":"Move boxes is off. You can scroll the page normally.");
  }));

  function arrangeMap(which) {
    const refs = mapRefs(which); if (!refs.map) return;
    const buckets = {purpose:[],system:[],person:[],device:[],service:[]};
    refs.map.nodes.forEach(n => (buckets[n.type] || buckets.device).push(n));
    const home = refs.map.nodes.find(n=>n.role==="home"); const tech=refs.map.nodes.find(n=>n.role==="tech");
    if (home) {home.x=(MAP_WIDTH-NODE_WIDTH)/2;home.y=20;} if(tech){tech.x=(MAP_WIDTH-NODE_WIDTH)/2;tech.y=125;}
    const sections=[buckets.purpose.filter(n=>n!==home),buckets.person,buckets.device,buckets.service];
    let y=245;
    sections.forEach(nodes=>{ if(!nodes.length)return; positionRows(nodes,y); y+=Math.ceil(nodes.length/5)*100+34; });
    refs.map.viewHeight=Math.max(720,y+20);
    state.dirty=true;
  }
  function positionRows(nodes,startY){
    const gap=24;
    for(let start=0;start<nodes.length;start+=5){
      const row=nodes.slice(start,start+5); const rowWidth=row.length*NODE_WIDTH+(row.length-1)*gap; const left=(MAP_WIDTH-rowWidth)/2;
      row.forEach((node,col)=>{node.x=left+col*(NODE_WIDTH+gap);node.y=startY+Math.floor(start/5)*100;});
    }
  }

  $("#fitMap").addEventListener("click",()=>{arrangeMap("v1");renderMap("v1");});
  $("#fitMapV2").addEventListener("click",()=>{arrangeMap("v2");renderMap("v2");});
  $("#fitMapQ").addEventListener("click",()=>{arrangeMap("q");renderMap("q");});

  function focusableIn(el){return $$('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',el).filter(item=>item.offsetParent!==null);}
  function openModal(el) { state.lastFocused=document.activeElement;el.classList.add("open");setTimeout(()=>focusableIn(el)[0]?.focus(),30); }
  function closeModals() { const hadOpen=$$(".modal-backdrop.open").length>0; $$(".modal-backdrop").forEach(m=>m.classList.remove("open"));if(hadOpen&&state.lastFocused instanceof HTMLElement)state.lastFocused.focus(); }
  $$('[data-close-modal]').forEach(b=>b.addEventListener("click",closeModals));
  $$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModals();}));
  document.addEventListener("keydown",e=>{
    const modal=$(".modal-backdrop.open");
    if(e.key==="Escape"&&modal){e.preventDefault();closeModals();return;}
    if(e.key!=="Tab"||!modal)return;
    const items=focusableIn(modal);if(!items.length)return;
    const first=items[0],last=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });

  $("#annotationTarget").addEventListener("change",e=>{
    const info=targetInfo(e.target.value);
    if(info?.targetType==="node"){
      state.selected.q=info.targetId;
      renderMap("q");
    } else if(info?.targetType==="edge"){state.selected.q=null;renderMap("q");}
    $("#questionPrompt").textContent=promptForTarget(e.target.value);
  });
  $("#annotationModalTarget").addEventListener("change",e=>$("#annotationSuggestion").textContent=promptForAnnotation(e.target.value,$("#annotationType").value));
  $("#annotationType").addEventListener("change",e=>$("#annotationSuggestion").textContent=promptForAnnotation($("#annotationModalTarget").value,e.target.value));
  $("#addAnnotationBtn").addEventListener("click",()=>openAnnotationModal($("#annotationTarget").value));
  $("#saveAnnotation").addEventListener("click",()=>{
    const info=targetInfo($("#annotationModalTarget").value),text=$("#annotationText").value.trim();
    const errors=[];
    if(!info)errors.push("Choose a box or relationship.");
    if(!text)errors.push("Write the question, assumption, uncertainty, evidence, or note you want to attach.");
    $("#annotationValidation").textContent=errors.join(" ");
    if(errors.length)return;
    state.annotations.push({id:id("note"),type:$("#annotationType").value,text,targetType:info.targetType,targetId:info.targetId,createdAt:new Date().toISOString()});
    state.dirty=true;$("#questionValidation").textContent="";closeModals();renderMap("q");selectQuestionTarget(`${info.targetType}:${info.targetId}`);
  });

  function openNodeModal(which, mode, nodeId=null) {
    state.activeMap=which; state.modalMode=mode;
    const node = nodeId ? mapRefs(which).map.nodes.find(n=>n.id===nodeId) : null;
    $("#nodeModalTitle").textContent = node ? "Edit this box" : "Add something missing";
    $("#nodeLabel").value=node?.label||""; $("#nodeType").value=node?.type||"device"; $("#nodeCertainty").value=node?.certainty||"known";
    $("#nodeValidation").textContent="";
    $("#nodeModal").dataset.nodeId=nodeId||""; openModal($("#nodeModal"));
  }

  function openEdgeModal(which) {
    state.activeMap=which; const refs=mapRefs(which);
    const options=refs.map.nodes.map(n=>`<option value="${n.id}">${esc(n.label)}</option>`).join("");
    $("#edgeFrom").innerHTML=options; $("#edgeTo").innerHTML=options; if(refs.map.nodes[1])$("#edgeTo").value=refs.map.nodes[1].id;
    $("#edgeLabel").value="";
    $("#edgeValidation").textContent="";
    $$('[data-relationship]').forEach(button=>button.setAttribute("aria-pressed","false"));
    openModal($("#edgeModal"));
  }

  $$('[data-relationship]').forEach(button=>button.addEventListener("click",()=>{
    $("#edgeLabel").value=button.dataset.relationship;
    $$('[data-relationship]').forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
  }));

  $("#addNodeBtn").addEventListener("click",()=>openNodeModal("v1","add"));
  $("#addNodeBtnV2").addEventListener("click",()=>openNodeModal("v2","add"));
  $("#editNodeBtn").addEventListener("click",()=>openNodeModal("v1","edit",state.selected.v1));
  $("#editNodeBtnV2").addEventListener("click",()=>openNodeModal("v2","edit",state.selected.v2));
  $("#addEdgeBtn").addEventListener("click",()=>openEdgeModal("v1"));
  $("#addEdgeBtnV2").addEventListener("click",()=>openEdgeModal("v2"));

  $("#saveNode").addEventListener("click",()=>{
    const label=$("#nodeLabel").value.trim();
    if(!label){$("#nodeValidation").textContent="Name what you want to add to the map.";$("#nodeLabel").focus();return;}
    const refs=mapRefs(state.activeMap), nodeId=$("#nodeModal").dataset.nodeId;
    if(state.modalMode==="edit"&&nodeId){ const n=refs.map.nodes.find(x=>x.id===nodeId); if(n){n.label=label;n.type=$("#nodeType").value;n.certainty=$("#nodeCertainty").value;} }
    else { refs.map.nodes.push(makeNode(label,$("#nodeType").value,"Added by the learner",$("#nodeCertainty").value,350,310,{addedV2:state.activeMap==="v2"})); }
    state.dirty=true; closeModals(); renderMap(state.activeMap);
  });

  $("#saveEdge").addEventListener("click",()=>{
    const from=$("#edgeFrom").value,to=$("#edgeTo").value,label=$("#edgeLabel").value.trim();
    const errors=[];
    if(from===to)errors.push("Choose two different boxes.");
    if(!label)errors.push("Choose or write how the boxes are related.");
    $("#edgeValidation").textContent=errors.join(" ");
    if(errors.length)return;
    const refs=mapRefs(state.activeMap); refs.map.edges.push(makeEdge(from,to,label,{addedV2:state.activeMap==="v2"})); state.dirty=true; closeModals(); renderMap(state.activeMap);
  });

  function chooseReveal() {
    const data=responseData(), useKeys=data.techUses.map(x=>x.key), deviceKeys=data.devices.map(x=>x.key), depKeys=data.dependencies.map(x=>x.key);
    if(useKeys.includes("work")||deviceKeys.includes("work-laptop")) return {title:"Look more closely at working from home",text:"Which of these does your work device actually use?",choices:["Work VPN","Employer sign-in","Device-management service","Company email","Work cloud storage"],anchorKey:"work-laptop",anchorLabel:"work device"};
    if(useKeys.includes("school")||depKeys.includes("school-systems")) return {title:"Look more closely at schoolwork",text:"Which of these is actually needed for a school activity?",choices:["School account","Learning portal","Video class service","School email","Online assignment system"],anchorKey:"school-systems",anchorLabel:"school activity"};
    if(deviceKeys.includes("connected")||useKeys.includes("smart")||useKeys.includes("health")) return {title:"Look more closely at a connected device",text:"Which of these does the device actually use?",choices:["Device company account","Mobile app","Cloud service","Phone or tablet","Paid subscription"],anchorKey:"connected",anchorLabel:"connected device"};
    if(deviceKeys.includes("game")) return {title:"Look more closely at the game console",text:"Which of these does the console actually use?",choices:["Platform account","Online store","Cloud save","Game subscription","Voice or multiplayer service"],anchorKey:"game",anchorLabel:"game console"};
    if(useKeys.includes("finance")) return {title:"Look more closely at one money task",text:"Which of these is actually needed for the task?",choices:["Bank or store account","Sign-in verification","Phone number","Email account","Payment service"],anchorKey:"finance",anchorLabel:"money task"};
    if(deviceKeys.includes("tv")||useKeys.includes("entertainment")) return {title:"Look more closely at one stream",text:"Which of these is actually needed to watch or listen?",choices:["Streaming account","Streaming service","Internet connection","Payment method","Device company account"],anchorKey:"tv",anchorLabel:"TV or streaming device"};
    return {title:"Look more closely at one important activity",text:"Which of these is actually needed for it to work?",choices:["A device","Internet connection","An account or sign-in","An outside service","Another person"],anchorKey:null,anchorLabel:"home technology system"};
  }

  function renderReveal(reveal) {
    const options=reveal.choices.map((label,index)=>`<label class="reveal-choice"><input type="checkbox" name="revealChoice" value="${esc(label)}"><span>${esc(label)}</span></label>`).join("");
    $("#revealCard").innerHTML=`<h3>${esc(reveal.title)}</h3><p>${esc(reveal.text)}</p><div class="reveal-choice-area"><fieldset><legend>Select everything that is true. Leave uncertain items unselected.</legend><div class="reveal-choice-grid">${options}</div></fieldset><div class="reveal-custom"><label for="revealOther">Something else that is true</label><input id="revealOther" type="text" placeholder="Add another account, service, device, or person"></div><p class="reveal-where"><strong>Where will these go?</strong> When you continue, Qonduit will add your choices as boxes in Version 2 and show that the ${esc(reveal.anchorLabel)} relies on them. You can edit that relationship if different words are more accurate. If none are true, open Version 2 without adding anything.</p></div>`;
  }

  function addRevealChoicesToVersion2() {
    const labels=$$('input[name="revealChoice"]:checked').map(input=>input.value);
    const other=$("#revealOther")?.value.trim(); if(other)labels.push(other);
    if(!labels.length)return;
    const map=state.mapV2;
    const anchor=map.nodes.find(node=>node.key===state.reveal.anchorKey)||map.nodes.find(node=>node.role==="tech")||map.nodes[0];
    labels.forEach(label=>{
      let node=map.nodes.find(item=>item.label.toLowerCase()===label.toLowerCase());
      if(!node){node=makeNode(label,"service","New information considered for Version 2","known",350,310,{addedV2:true});map.nodes.push(node);}
      if(anchor&&!map.edges.some(edge=>edge.from===anchor.id&&edge.to===node.id))map.edges.push(makeEdge(anchor.id,node.id,"relies on",{addedV2:true}));
    });
  }

  $("#saveV1").addEventListener("click",()=>{
    state.snapshotV1=clone(state.mapV1); state.reveal=chooseReveal(); state.mapV2=clone(state.mapV1);
    state.mapV2.nodes.forEach(n=>n.addedV2=false); state.mapV2.edges.forEach(e=>e.addedV2=false);
    renderReveal(state.reveal);
    state.dirty=true; setStep(6);
  });

  $("#reviseMap").addEventListener("click",()=>{
    addRevealChoicesToVersion2(); $("#version2Area").hidden=false; $("#reviseMap").hidden=true; state.activeMap="v2";state.selected.v2=state.mapV2.nodes.find(node=>node.role==="tech")?.id||null;setJourneyStage("revise");arrangeMap("v2");renderMap("v2");
  });

  function diffMaps(a,b) {
    const aNodes=new Map(a.nodes.map(n=>[n.id,n])), bNodes=new Map(b.nodes.map(n=>[n.id,n]));
    const added=[...bNodes.values()].filter(n=>!aNodes.has(n.id));
    const changed=[...bNodes.values()].filter(n=>aNodes.has(n.id)&&(n.label!==aNodes.get(n.id).label||n.certainty!==aNodes.get(n.id).certainty));
    const removed=[...aNodes.values()].filter(n=>!bNodes.has(n.id));
    return {added,changed,removed,edgeDelta:b.edges.length-a.edges.length};
  }

  $("#saveV2").addEventListener("click",()=>{
    state.snapshotV2=clone(state.mapV2); const diff=diffMaps(state.snapshotV1,state.snapshotV2);
    $("#comparison").innerHTML=`
      <div class="metric"><strong>${diff.added.length}</strong><span>pieces added</span></div>
      <div class="metric"><strong>${diff.changed.length}</strong><span>pieces revised</span></div>
      <div class="metric"><strong>${diff.edgeDelta>=0?"+":""}${diff.edgeDelta}</strong><span>change in relationships</span></div>`;
    $("#reflectionArea").hidden=false; $("#saveV2").disabled=true; state.dirty=true; $("#downloadOptions").scrollIntoView({behavior:"smooth",block:"start"});
  });

  let toastTimer=null,undoCallback=null;
  function showToast(message,undo=null){
    clearTimeout(toastTimer);undoCallback=undo;$("#undoMessage").textContent=message;$("#undoAction").hidden=!undo;$("#undoToast").hidden=false;
    toastTimer=setTimeout(()=>{$("#undoToast").hidden=true;undoCallback=null;},undo?7000:4000);
  }
  function showUndo(message,callback){showToast(message,callback);}
  function showStatus(message){showToast(message);}
  $("#undoAction").addEventListener("click",()=>{if(undoCallback)undoCallback();showStatus("Change restored.");});
  $("#undoDismiss").addEventListener("click",()=>{clearTimeout(toastTimer);$("#undoToast").hidden=true;undoCallback=null;});

  function downloadBlob(content,type,filename,message="Download started.") {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a"); a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); state.downloaded=true;state.dirty=false;
    showStatus(message);
  }

  function downloadProject() {
    const currentReflection={becameVisible:$("#reflectionVisible").value.trim(),nextQuestion:$("#reflectionQuestion").value.trim()};
    const project={
      format:"qonduit-project",
      version:2,
      createdAt:state.projectCreatedAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      responses:state.importedResponses||responseData(),
      reveal:state.reveal,
      version1:state.snapshotV1||state.mapV1,
      version2:state.snapshotV2||state.mapV2,
      questionedMap:state.mapQ,
      annotations:state.annotations,
      reflection:state.importedReflection||currentReflection
    };
    downloadBlob(JSON.stringify(project,null,2),"application/json","qonduit-home-system-project.json","Editable Qonduit project download started.");
  }

  function downloadMapPng(selector,filename,message="Map image download started.") {
    const source=$(selector); const copy=source.cloneNode(true); const vb=source.viewBox.baseVal; const outputWidth=1600; const outputHeight=Math.round(outputWidth*(vb.height/vb.width)); copy.setAttribute("xmlns",SVG_NS); copy.setAttribute("width",String(outputWidth));copy.setAttribute("height",String(outputHeight));
    copy.querySelectorAll(".dimmed").forEach(el=>el.classList.remove("dimmed"));
    const style=document.createElementNS(SVG_NS,"style"); style.textContent=`text{font-family:Arial,sans-serif}.svg-edge{stroke:#7d91a5;stroke-width:2}.svg-edge.new{stroke:#9a5b08;stroke-dasharray:7 5;stroke-width:3}.svg-edge.annotated{stroke:#5f3e96;stroke-width:3}.edge-label-bg{fill:#fffdf8;stroke:#c97700;stroke-width:2}.edge-label{font-size:15px;font-weight:700;fill:#563300}.node-group text{font-size:13px;font-weight:700;fill:#172433}.node-shape{stroke-width:2}.annotation-badge{fill:#042c53;stroke:#fff;stroke-width:3}.annotation-badge-text{fill:#fff;font-size:12px;font-weight:800}`; copy.insertBefore(style,copy.firstChild);
    const bg=document.createElementNS(SVG_NS,"rect");bg.setAttribute("width","100%");bg.setAttribute("height","100%");bg.setAttribute("fill","#f8fbfe");copy.insertBefore(bg,style.nextSibling);
    const xml=new XMLSerializer().serializeToString(copy),svgBlob=new Blob([xml],{type:"image/svg+xml"}),url=URL.createObjectURL(svgBlob),img=new Image();
    img.onload=()=>{const canvas=document.createElement("canvas");canvas.width=outputWidth;canvas.height=outputHeight;const ctx=canvas.getContext("2d");ctx.fillStyle="#f8fbfe";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(blob=>{if(!blob){showStatus("The map image could not be created. Try again.");return;}const out=URL.createObjectURL(blob),a=document.createElement("a");a.href=out;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(out),1000);state.downloaded=true;showStatus(message);},"image/png");};
    img.onerror=()=>{URL.revokeObjectURL(url);showStatus("The map image could not be created. Try again.");};
    img.src=url;
  }

  function validMap(map) {
    if(!map||!Array.isArray(map.nodes)||!Array.isArray(map.edges))return false;
    if(map.nodes.length>500||map.edges.length>3000)return false;
    const safeId=/^[A-Za-z0-9_-]{1,120}$/;
    const ids=new Set(map.nodes.map(node=>node?.id));
    return map.nodes.every(node=>node&&safeId.test(node.id)&&typeof node.label==="string"&&node.label.length<=300&&Number.isFinite(node.x)&&Math.abs(node.x)<=10000&&Number.isFinite(node.y)&&Math.abs(node.y)<=10000)&&map.edges.every(edge=>edge&&safeId.test(edge.id)&&ids.has(edge.from)&&ids.has(edge.to)&&typeof edge.label==="string"&&edge.label.length<=300);
  }

  function openImportedProject(project) {
    if(!project||project.format!=="qonduit-project")throw new Error("This is not a Qonduit project file.");
    const version1=project.version1,version2=project.version2;
    if(!validMap(version1)||!validMap(version2))throw new Error("This project does not contain usable Version 1 and Version 2 maps.");
    state.snapshotV1=clone(version1);state.mapV1=clone(version1);
    state.snapshotV2=clone(version2);state.mapV2=clone(version2);
    state.mapQ=clone(validMap(project.questionedMap)?project.questionedMap:version2);
    const validNodeIds=new Set(state.mapQ.nodes.map(node=>node.id)),validEdgeIds=new Set(state.mapQ.edges.map(edge=>edge.id));
    state.annotations=Array.isArray(project.annotations)?project.annotations.slice(0,1000).filter(item=>item&&/^[A-Za-z0-9_-]{1,120}$/.test(item.id)&&typeof item.text==="string"&&item.text.length<=5000&&["question","assumption","uncertainty","evidence","note"].includes(item.type)&&((item.targetType==="node"&&validNodeIds.has(item.targetId))||(item.targetType==="edge"&&validEdgeIds.has(item.targetId)))):[];
    state.importedResponses=project.responses||null;state.importedReflection=project.reflection||null;state.reveal=project.reveal||null;state.projectCreatedAt=project.createdAt||new Date().toISOString();
    state.selected.q=null;state.dirty=false;state.downloaded=true;state.openedFromFile=true;
  }

  function startQuestionExperience() {
    const source=state.mapQ||state.snapshotV2||state.mapV2;
    if(!validMap(source))return;
    if(!state.mapQ)state.mapQ=clone(source);
    state.activeMap="q";
    setJourneyStage("question");
    $("#experienceOne").hidden=true;$("#continueCard").hidden=true;$("#questionExperience").hidden=false;
    $("#questionResults").hidden=true;
    populateAnnotationTargets();renderMap("q");
    $("#questionExperience").scrollIntoView({behavior:"smooth",block:"start"});
    $("#questionExperienceTitle").setAttribute("tabindex","-1");$("#questionExperienceTitle").focus({preventScroll:true});
  }

  $("#projectFile").addEventListener("change",async e=>{
    const file=e.target.files?.[0],status=$("#importStatus"),button=$("#beginImportedExperience");
    status.className="file-status";button.hidden=true;
    if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error("That file is too large to be a Qonduit project.");
      const project=JSON.parse(await file.text());openImportedProject(project);
      status.textContent=`${file.name} is ready. Your map stays in this browser.`;status.classList.add("success");button.hidden=false;
    }catch(error){status.textContent=error instanceof SyntaxError?"That file is not valid JSON. Choose a Qonduit project file.":error.message;status.classList.add("error");e.target.value="";}
  });

  $("#beginImportedExperience").addEventListener("click",startQuestionExperience);
  $("#continueToQuestions").addEventListener("click",()=>{state.openedFromFile=false;if(!state.mapQ){state.mapQ=clone(state.snapshotV2||state.mapV2);state.annotations=[];}startQuestionExperience();});
  $("#returnToOpening").addEventListener("click",()=>{$("#questionExperience").hidden=true;$("#experienceOne").hidden=state.openedFromFile;$("#continueCard").hidden=false;$("#continueCard").open=true;$("#continueCard").scrollIntoView({behavior:"smooth",block:"start"});});
  $("#finishQuestioning").addEventListener("click",()=>{
    if(!state.annotations.length){$("#questionValidation").textContent="Attach at least one question, assumption, uncertainty, piece of evidence, or note before finishing.";$("#mapPanelQ").scrollIntoView({behavior:"smooth",block:"start"});return;}
    const counts=type=>state.annotations.filter(item=>item.type===type).length;
    $("#annotationSummary").innerHTML=`<div class="metric"><strong>${state.annotations.length}</strong><span>items attached</span></div><div class="metric"><strong>${counts("question")+counts("uncertainty")}</strong><span>open questions or checks</span></div><div class="metric"><strong>${counts("assumption")+counts("evidence")}</strong><span>assumptions or evidence</span></div>`;
    $("#questionResults").hidden=false;$("#questionResults").scrollIntoView({behavior:"smooth",block:"start"});
  });

  $("#downloadProject").addEventListener("click",downloadProject);
  $("#downloadV1").addEventListener("click",()=>downloadMapPng("#mapCanvas","qonduit-home-system-map-version-1.png","Version 1 image download started."));
  $("#downloadV1After").addEventListener("click",()=>downloadMapPng("#mapCanvas","qonduit-home-system-map-version-1.png","Version 1 image download started."));
  $("#downloadPng").addEventListener("click",()=>downloadMapPng("#mapCanvasV2","qonduit-home-system-map.png","Version 2 image download started."));
  $("#downloadAnnotatedPng").addEventListener("click",()=>downloadMapPng("#mapCanvasQ","qonduit-questioned-system-map.png","Annotated map download started."));
  $("#downloadQuestionedProject").addEventListener("click",downloadProject);
  $("#reflectionVisible").addEventListener("input",()=>state.dirty=true);
  $("#reflectionQuestion").addEventListener("input",()=>state.dirty=true);
  $("#startOver").addEventListener("click",()=>{if(confirm("Clear this work and start again? Nothing can be recovered unless you downloaded it.")){state.dirty=false;location.reload();}});

  let resizeTimer;
  window.addEventListener("resize",()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      if(state.step===5&&state.mapV1)renderMap("v1");
      if(state.step===6&&state.mapV2&&!$("#version2Area").hidden)renderMap("v2");
      if(state.mapQ&&!$("#questionExperience").hidden)renderMap("q");
    },120);
  });

  window.addEventListener("beforeunload",e=>{if(state.dirty){e.preventDefault();e.returnValue="";}});
})();
