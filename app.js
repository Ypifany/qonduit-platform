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
    snapshotV1: null,
    snapshotV2: null,
    reveal: null,
    dirty: false,
    downloaded: false,
    activeMap: "v1",
    selected: { v1: null, v2: null },
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
    $("#stepLabel").textContent = `Step ${number} of 6`;
    $("#stepName").textContent = stepNames[number - 1];
    $("#progressBar").style.width = `${number / 6 * 100}%`;
    $("#experience").scrollIntoView({behavior: "smooth", block: "start"});
    const title = $(`.step[data-step="${number}"] h2`);
    if (title) title.setAttribute("tabindex", "-1"), title.focus({preventScroll: true});
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
    state.activeMap = "v1";
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
    const v2 = which === "v2";
    return {
      map: v2 ? state.mapV2 : state.mapV1,
      svg: $(v2 ? "#mapCanvasV2" : "#mapCanvas"),
      nodeLayer: $(v2 ? "#nodeLayerV2" : "#nodeLayer"),
      edgeLayer: $(v2 ? "#edgeLayerV2" : "#edgeLayer"),
      nodeList: $(v2 ? "#nodeListV2" : "#nodeList"),
      edgeList: $(v2 ? "#edgeListV2" : "#edgeList"),
      editButton: $(v2 ? "#editNodeBtnV2" : "#editNodeBtn")
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
    const renderedWidth = window.matchMedia("(max-width: 760px)").matches ? 760 : refs.svg.parentElement.clientWidth;
    refs.svg.style.height = `${Math.max(refs.svg.parentElement.clientHeight, Math.round(renderedWidth * viewHeight / MAP_WIDTH))}px`;
    refs.edgeLayer.innerHTML = ""; refs.nodeLayer.innerHTML = "";
    const selected = state.selected[which];
    const relatedEdges = selected ? refs.map.edges.filter(edge => edge.from === selected || edge.to === selected) : [];
    const showLabelsOnMap = relatedEdges.length > 0 && relatedEdges.length <= 8;
    const shownRelationshipLabels = new Set();
    refs.map.edges.forEach(edge => {
      const a = refs.map.nodes.find(n => n.id === edge.from); const b = refs.map.nodes.find(n => n.id === edge.to);
      if (!a || !b) return;
      const related = selected && (edge.from === selected || edge.to === selected);
      const dimmed = selected && !related;
      const line = svgEl("line", {x1:a.x + NODE_WIDTH / 2, y1:a.y + NODE_HEIGHT / 2, x2:b.x + NODE_WIDTH / 2, y2:b.y + NODE_HEIGHT / 2, class:`svg-edge${edge.addedV2 ? " new" : ""}${related ? " active" : ""}${dimmed ? " dimmed" : ""}`});
      refs.edgeLayer.append(line);
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
      const g = svgEl("g", {transform:`translate(${node.x} ${node.y})`, class:`node-group${selected === node.id ? " selected" : ""}${isDimmed ? " dimmed" : ""}${node.addedV2 ? " added-v2" : ""}`, tabindex:"0", role:"button", "aria-label":`${node.label}. ${node.type}. ${node.certainty}. ${node.detail || ""}`, "data-node-id":node.id});
      const rect = svgEl("rect", {width:String(NODE_WIDTH), height:String(NODE_HEIGHT), rx:"13", fill:style.fill, stroke:style.stroke, class:"node-shape"});
      if (node.certainty !== "known") rect.setAttribute("stroke-dasharray", node.certainty === "assumed" ? "7 5" : "3 4");
      const title = svgEl("title"); title.textContent = `${node.label}: ${node.detail || node.type} (${node.certainty})`; g.append(title, rect);
      wrapLabel(node.label, 22).forEach((line, i, arr) => {
        const t = svgEl("text", {x:String(NODE_WIDTH / 2), y:String(36 - (arr.length-1)*9 + i*18), "text-anchor":"middle", style:`fill:${style.text || "#172433"}`}); t.textContent = line; g.append(t);
      });
      addNodeInteractions(g, node, which);
      refs.nodeLayer.append(g);
    });
    renderOutline(which);
    refs.editButton.disabled = !selected;
  }

  function addNodeInteractions(group, node, which) {
    let dragging = false; let offset = {x:0,y:0};
    group.addEventListener("pointerdown", e => {
      state.selected[which] = node.id; state.activeMap = which;
      dragging = true;
      const p = clientToSvg(e, mapRefs(which).svg); offset = {x:p.x-node.x, y:p.y-node.y};
      group.classList.add("selected");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, {once:true});
    });
    function move(e) {
      if (!dragging) return;
      const p = clientToSvg(e, mapRefs(which).svg);
      const bounds = mapRefs(which).svg.viewBox.baseVal;
      node.x = Math.max(0, Math.min(bounds.width - NODE_WIDTH, p.x-offset.x)); node.y = Math.max(0, Math.min(bounds.height - NODE_HEIGHT, p.y-offset.y));
      state.dirty = true; renderMap(which);
    }
    function stop() { dragging = false; window.removeEventListener("pointermove", move); renderMap(which); }
    group.addEventListener("dblclick", () => openNodeModal(which, "edit", node.id));
    group.addEventListener("keydown", e => {
      if (["Enter"," "].includes(e.key)) { e.preventDefault(); state.selected[which] = node.id; renderMap(which); openNodeModal(which,"edit",node.id); return; }
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

  function renderOutline(which) {
    const refs = mapRefs(which); if (!refs.map) return;
    const selected = state.selected[which];
    refs.nodeList.innerHTML = refs.map.nodes.map(n => {
      const status = n.certainty === "known" ? "Known" : n.certainty === "assumed" ? "Assumed" : "Need to check";
      return `<li class="${selected === n.id ? "is-selected" : ""}"><button class="node-select" type="button" data-select-node="${n.id}" data-map="${which}" aria-pressed="${selected === n.id}"><strong>${esc(n.label)}</strong><small>${esc(status)}</small></button><button class="node-delete" type="button" data-delete-node="${n.id}" data-map="${which}" aria-label="Delete ${esc(n.label)}">×</button></li>`;
    }).join("");
    refs.edgeList.innerHTML = refs.map.edges.map(edge => {
      const a=refs.map.nodes.find(n=>n.id===edge.from), b=refs.map.nodes.find(n=>n.id===edge.to);
      return `<li><button type="button" data-delete-edge="${edge.id}" data-map="${which}" aria-label="Delete relationship">×</button>${esc(a?.label || "Missing")} <strong>${esc(edge.label)}</strong> ${esc(b?.label || "Missing")}</li>`;
    }).join("") || "<li>No relationships yet.</li>";
    const selectedNode = refs.map.nodes.find(n => n.id === selected);
    const relationshipWords = [...new Set(refs.map.edges.filter(edge => edge.from === selected || edge.to === selected).map(edge => edge.label))];
    const help = $(which === "v1" ? "#selectedHelp" : "#selectedHelpV2");
    if (help) help.textContent = selectedNode ? `${selectedNode.label} is highlighted. Direct relationships: ${relationshipWords.join(", ") || "none yet"}.` : "Select a box on the map or use a button in the outline.";
  }

  document.addEventListener("click", e => {
    const select = e.target.closest("[data-select-node]");
    const delNode = e.target.closest("[data-delete-node]");
    const delEdge = e.target.closest("[data-delete-edge]");
    const panelTop = e.target.closest("[data-panel-top]");
    const outlineToggle = e.target.closest("[data-close-outline]");
    if (panelTop) {
      const panel = document.getElementById(panelTop.dataset.panelTop);
      panel?.scrollTo({top:0,behavior:"auto"});
    }
    if (outlineToggle) {
      const outline = document.getElementById(outlineToggle.dataset.closeOutline);
      if (outline) {
        outline.open = !outline.open;
        outlineToggle.textContent = outline.open ? "Close outline" : "Open outline";
        outlineToggle.setAttribute("aria-expanded", String(outline.open));
        if (!outline.open) outline.closest(".map-panel")?.scrollTo({top:0,behavior:"auto"});
      }
    }
    if (select) { state.selected[select.dataset.map] = select.dataset.selectNode; state.activeMap=select.dataset.map; renderMap(select.dataset.map); }
    if (delNode) {
      const refs=mapRefs(delNode.dataset.map), nodeId=delNode.dataset.deleteNode;
      refs.map.nodes=refs.map.nodes.filter(n=>n.id!==nodeId); refs.map.edges=refs.map.edges.filter(x=>x.from!==nodeId&&x.to!==nodeId); state.selected[delNode.dataset.map]=null; state.dirty=true; renderMap(delNode.dataset.map);
    }
    if (delEdge) { const refs=mapRefs(delEdge.dataset.map); refs.map.edges=refs.map.edges.filter(x=>x.id!==delEdge.dataset.deleteEdge); state.dirty=true; renderMap(delEdge.dataset.map); }
  });

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

  function openModal(el) { el.classList.add("open"); setTimeout(()=>$("input,select,button",el)?.focus(),30); }
  function closeModals() { $$(".modal-backdrop").forEach(m=>m.classList.remove("open")); }
  $$('[data-close-modal]').forEach(b=>b.addEventListener("click",closeModals));
  $$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModals();}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModals();});

  function openNodeModal(which, mode, nodeId=null) {
    state.activeMap=which; state.modalMode=mode;
    const node = nodeId ? mapRefs(which).map.nodes.find(n=>n.id===nodeId) : null;
    $("#nodeModalTitle").textContent = node ? "Edit this piece" : "Add a piece";
    $("#nodeLabel").value=node?.label||""; $("#nodeType").value=node?.type||"device"; $("#nodeCertainty").value=node?.certainty||"known";
    $("#nodeModal").dataset.nodeId=nodeId||""; openModal($("#nodeModal"));
  }

  function openEdgeModal(which) {
    state.activeMap=which; const refs=mapRefs(which);
    const options=refs.map.nodes.map(n=>`<option value="${n.id}">${esc(n.label)}</option>`).join("");
    $("#edgeFrom").innerHTML=options; $("#edgeTo").innerHTML=options; if(refs.map.nodes[1])$("#edgeTo").value=refs.map.nodes[1].id;
    $("#edgeLabel").value="relies on"; openModal($("#edgeModal"));
  }

  $("#addNodeBtn").addEventListener("click",()=>openNodeModal("v1","add"));
  $("#addNodeBtnV2").addEventListener("click",()=>openNodeModal("v2","add"));
  $("#editNodeBtn").addEventListener("click",()=>openNodeModal("v1","edit",state.selected.v1));
  $("#editNodeBtnV2").addEventListener("click",()=>openNodeModal("v2","edit",state.selected.v2));
  $("#addEdgeBtn").addEventListener("click",()=>openEdgeModal("v1"));
  $("#addEdgeBtnV2").addEventListener("click",()=>openEdgeModal("v2"));

  $("#saveNode").addEventListener("click",()=>{
    const label=$("#nodeLabel").value.trim(); if(!label){$("#nodeLabel").focus();return;}
    const refs=mapRefs(state.activeMap), nodeId=$("#nodeModal").dataset.nodeId;
    if(state.modalMode==="edit"&&nodeId){ const n=refs.map.nodes.find(x=>x.id===nodeId); if(n){n.label=label;n.type=$("#nodeType").value;n.certainty=$("#nodeCertainty").value;} }
    else { refs.map.nodes.push(makeNode(label,$("#nodeType").value,"Added by the learner",$("#nodeCertainty").value,350,310,{addedV2:state.activeMap==="v2"})); }
    state.dirty=true; closeModals(); renderMap(state.activeMap);
  });

  $("#saveEdge").addEventListener("click",()=>{
    const from=$("#edgeFrom").value,to=$("#edgeTo").value,label=$("#edgeLabel").value.trim()||"relates to"; if(from===to)return;
    const refs=mapRefs(state.activeMap); refs.map.edges.push(makeEdge(from,to,label,{addedV2:state.activeMap==="v2"})); state.dirty=true; closeModals(); renderMap(state.activeMap);
  });

  function chooseReveal() {
    const data=responseData(), useKeys=data.techUses.map(x=>x.key), deviceKeys=data.devices.map(x=>x.key), depKeys=data.dependencies.map(x=>x.key);
    if(useKeys.includes("work")||deviceKeys.includes("work-laptop")) return {title:"Trace the work connection",text:"Choose the device you use for work. Check whether it relies on a VPN, employer sign-in, device-management service, company email, or cloud storage that is missing from your map.",prompt:"Add what is true. If none applies, mark the relationship you still need to check."};
    if(useKeys.includes("school")||depKeys.includes("school-systems")) return {title:"Look behind the school account",text:"Choose one school activity. Check what account, portal, identity service, device, and internet connection must work for that activity to happen.",prompt:"Add the missing piece or relationship that is actually part of your household's use."};
    if(deviceKeys.includes("connected")||useKeys.includes("smart")||useKeys.includes("health")) return {title:"Follow the connected device",text:"Choose one connected home, health, or exercise device. Check whether it communicates with a company account, mobile app, cloud service, or phone that is missing from your map.",prompt:"Add only what you can support. Mark uncertain connections as “Need to check.”"};
    if(deviceKeys.includes("game")) return {title:"Look beyond the console",text:"Check whether the game console relies on a platform account, online store, cloud save, subscription, voice service, or multiplayer network that is not shown.",prompt:"Add the relationship that best reflects how it is actually used."};
    if(useKeys.includes("finance")) return {title:"Trace one money task",text:"Choose one banking, billing, or shopping task. Check what device, sign-in method, phone number, email account, app, and outside service must work together.",prompt:"Add one missing dependency or mark what you need to verify."};
    if(deviceKeys.includes("tv")||useKeys.includes("entertainment")) return {title:"Follow one stream",text:"Choose one thing your household watches or listens to. Check what device, account, streaming service, internet connection, and payment relationship make it available.",prompt:"Add what is missing from your current picture."};
    return {title:"Trace one activity from end to end",text:"Choose one important thing your household does with technology. Start with the person doing it and follow every device, connection, account, and outside service needed for it to work.",prompt:"Add one relationship that your first map did not make visible."};
  }

  $("#saveV1").addEventListener("click",()=>{
    state.snapshotV1=clone(state.mapV1); state.reveal=chooseReveal(); state.mapV2=clone(state.mapV1);
    state.mapV2.nodes.forEach(n=>n.addedV2=false); state.mapV2.edges.forEach(e=>e.addedV2=false);
    $("#revealCard").innerHTML=`<h3>${esc(state.reveal.title)}</h3><p>${esc(state.reveal.text)}</p><p><strong>${esc(state.reveal.prompt)}</strong></p>`;
    state.dirty=true; setStep(6);
  });

  $("#reviseMap").addEventListener("click",()=>{
    $("#version2Area").hidden=false; $("#reviseMap").hidden=true; state.activeMap="v2"; arrangeMap("v2"); renderMap("v2");
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
    $("#reflectionArea").hidden=false; $("#saveV2").disabled=true; state.dirty=true; $("#reflectionArea").scrollIntoView({behavior:"smooth"});
  });

  function downloadBlob(content,type,filename) {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a"); a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); state.downloaded=true;
  }

  function downloadProject() {
    const project={format:"qonduit-project",version:1,createdAt:new Date().toISOString(),responses:responseData(),reveal:state.reveal,version1:state.snapshotV1,version2:state.snapshotV2||state.mapV2,reflection:{becameVisible:$("#reflectionVisible").value.trim(),nextQuestion:$("#reflectionQuestion").value.trim()}};
    downloadBlob(JSON.stringify(project,null,2),"application/json","qonduit-home-system-project.json");
  }

  function downloadPng() {
    const source=$("#mapCanvasV2"); const copy=source.cloneNode(true); const vb=source.viewBox.baseVal; const outputWidth=1600; const outputHeight=Math.round(outputWidth*(vb.height/vb.width)); copy.setAttribute("xmlns",SVG_NS); copy.setAttribute("width",String(outputWidth));copy.setAttribute("height",String(outputHeight));
    copy.querySelectorAll(".dimmed").forEach(el=>el.classList.remove("dimmed"));
    const style=document.createElementNS(SVG_NS,"style"); style.textContent=`text{font-family:Arial,sans-serif}.svg-edge{stroke:#7d91a5;stroke-width:2}.svg-edge.new{stroke:#9a5b08;stroke-dasharray:7 5;stroke-width:3}.edge-label-bg{fill:#fffdf8;stroke:#c97700;stroke-width:2}.edge-label{font-size:15px;font-weight:700;fill:#563300}.node-group text{font-size:13px;font-weight:700;fill:#172433}.node-shape{stroke-width:2}`; copy.insertBefore(style,copy.firstChild);
    const bg=document.createElementNS(SVG_NS,"rect");bg.setAttribute("width","100%");bg.setAttribute("height","100%");bg.setAttribute("fill","#f8fbfe");copy.insertBefore(bg,style.nextSibling);
    const xml=new XMLSerializer().serializeToString(copy),svgBlob=new Blob([xml],{type:"image/svg+xml"}),url=URL.createObjectURL(svgBlob),img=new Image();
    img.onload=()=>{const canvas=document.createElement("canvas");canvas.width=outputWidth;canvas.height=outputHeight;const ctx=canvas.getContext("2d");ctx.fillStyle="#f8fbfe";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(blob=>{const out=URL.createObjectURL(blob),a=document.createElement("a");a.href=out;a.download="qonduit-home-system-map.png";a.click();setTimeout(()=>URL.revokeObjectURL(out),1000);state.downloaded=true;},"image/png");};img.src=url;
  }

  $("#downloadProject").addEventListener("click",downloadProject);
  $("#downloadPng").addEventListener("click",downloadPng);
  $("#reflectionVisible").addEventListener("input",()=>state.dirty=true);
  $("#reflectionQuestion").addEventListener("input",()=>state.dirty=true);
  $("#startOver").addEventListener("click",()=>{if(confirm("Clear this work and start again? Nothing can be recovered unless you downloaded it.")){state.dirty=false;location.reload();}});

  let resizeTimer;
  window.addEventListener("resize",()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      if(state.step===5&&state.mapV1)renderMap("v1");
      if(state.step===6&&state.mapV2&&!$("#version2Area").hidden)renderMap("v2");
    },120);
  });

  window.addEventListener("beforeunload",e=>{if(state.dirty&&!state.downloaded){e.preventDefault();e.returnValue="";}});
})();
