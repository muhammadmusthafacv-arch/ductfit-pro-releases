/**
 * ASHRAE Duct Fitting Database & Sizer Logic v6.0
 * Authentic reproduction of ASHRAE Database v5.0 / v6.0 + Integrated Duct Sizer
 */

(function () {
    "use strict";

    // Official ASHRAE Handbook—Fundamentals Ch. 21 Table 1 Duct Roughness Materials
    const ASHRAE_ROUGHNESS_MATERIALS = [
        { si: "0.04600", ip: "0.00015", name: "PVC Pipe" },
        { si: "0.04600", ip: "0.00015", name: "Commercial Steel" },
        { si: "0.06100", ip: "0.00020", name: "Aluminum Duct, Round" },
        { si: "0.09000", ip: "0.00030", name: "Galvanized Steel, Round, Longitudinal Seams" },
        { si: "0.12000", ip: "0.00040", name: "Galvanized Steel, Round, Spiral" },
        { si: "0.15000", ip: "0.00050", name: "Galvanized Steel, Rectangular" },
        { si: "0.21336", ip: "0.00070", name: "Galvanized Steel, Medium Roughness (McQuay Default)" },
        { si: "0.90000", ip: "0.00300", name: "Flexible Duct, Fabric & Wire" },
        { si: "0.91000", ip: "0.00300", name: "Galvanized Steel, Round, Spiral, Corrugated" },
        { si: "0.91000", ip: "0.00300", name: "Fibrous Glass Duct, Rigid" },
        { si: "1.52000", ip: "0.00500", name: "Duct Liner, Fibrous Glass, Air Side w/Facing Material" },
        { si: "3.00000", ip: "0.01000", name: "Concrete" },
        { si: "4.57000", ip: "0.01500", name: "Duct Liner, Fibrous Glass, Spray Coated" }
    ];

    // Standard Air Condition Thermodynamic Presets (Exact McQuay Parity)
    const AIR_CONDITIONS = {
        stp: {
            id: "stp",
            name_si: "20°C Air STP",
            name_ip: "68°F Air STP",
            density_si: 1.2014,
            density_ip: 0.0750,
            viscosity_si: 0.0643,
            viscosity_ip: 0.0432,
            viscosity_pas: 0.0643 / 3600.0,
            cp_si: 1.0048,
            cp_ip: 0.2400,
            energy_factor_si: 1.21,
            energy_factor_ip: 1.08
        },
        cold_supply: {
            id: "cold_supply",
            name_si: "13°C Air at 97% RH and 1 atm",
            name_ip: "55°F Air at 97% RH and 1 atm",
            density_si: 1.2158,
            density_ip: 0.0759,
            viscosity_si: 0.0637,
            viscosity_ip: 0.0428,
            viscosity_pas: 0.0637 / 3600.0,
            cp_si: 1.0048,
            cp_ip: 0.2400,
            energy_factor_si: 1.22,
            energy_factor_ip: 1.09
        },
        comfort_return: {
            id: "comfort_return",
            name_si: "25°C Air at 50% RH and 1 atm",
            name_ip: "75°F Air at 50% RH and 1 atm",
            density_si: 1.1710,
            density_ip: 0.0731,
            viscosity_si: 0.0656,
            viscosity_ip: 0.0441,
            viscosity_pas: 0.0656 / 3600.0,
            cp_si: 1.0048,
            cp_ip: 0.2400,
            energy_factor_si: 1.18,
            energy_factor_ip: 1.05
        },
        warm_heating: {
            id: "warm_heating",
            name_si: "37°C Air at 23% RH and 1 atm",
            name_ip: "100°F Air at 23% RH and 1 atm",
            density_si: 1.1184,
            density_ip: 0.0698,
            viscosity_si: 0.0680,
            viscosity_ip: 0.0457,
            viscosity_pas: 0.0680 / 3600.0,
            cp_si: 1.0048,
            cp_ip: 0.2400,
            energy_factor_si: 1.12,
            energy_factor_ip: 1.01
        },
        hot_supply: {
            id: "hot_supply",
            name_si: "52°C Air at 11% RH and 1 atm",
            name_ip: "125°F Air at 11% RH and 1 atm",
            density_si: 1.0708,
            density_ip: 0.0669,
            viscosity_si: 0.0704,
            viscosity_ip: 0.0473,
            viscosity_pas: 0.0704 / 3600.0,
            cp_si: 1.0048,
            cp_ip: 0.2400,
            energy_factor_si: 1.08,
            energy_factor_ip: 0.96
        }
    };

    // Application State
    const state = {
        catalogTree: null,
        activeCode: "CR11-1",
        lastDirectCode: "CR11-1",
        activeItem: null,
        mode: "direct",       // 'direct' (loss calculation) or 'sizer' (duct sizing)
        unit: "SI",           // 'SI' or 'IP'
        showValuesInDrawing: true,
        activeData: null,

        // Air Condition state (Default: 25°C Air at 50% RH and 1 atm)
        selectedAirConditionId: "comfort_return",

        // Sizing inputs
        sizeTargetType: "friction", // 'friction' or 'velocity'
        sizeTargetVal: 1.0,         // Pa/m (or in. wg/100ft)
        sizeFixedType: "H",         // 'H', 'W', or 'AR'
        sizeFixedDim: 300,          // mm (or in.)
        userSizerValues: {},        // Preserved in-session inputs for Auto Duct Sizer (resets on refresh / restart)

        // Fullscreen & Workspace Zoom state
        isFullscreen: false,
        isCalcCollapsed: false,
        isCalcFullscreen: false,
        calcFsZoom: 1.0,
        cadZoom: 1.0,
        diagramMode: "official", // 'official' (ASHRAE Blueprint) or 'svg' (Live Vector CAD)

        // Absolute Roughness Material Picker State (Defaults to blank until entered or selected)
        selectedRoughnessMaterial: null,
        activeRoughnessIndex: -1,
        userRoughnessValue: null,
        targetRoughnessFieldId: "e",

        // Project Management State (ASHRAE Duct Schedule Model)
        projects: [],
        activeProjectId: null,
        activeProject: null
    };

    // DOM Elements
    const elements = {
        // Tree Sidebar
        treeSearchInput: document.getElementById("treeSearchInput"),
        btnClearTreeSearch: document.getElementById("btnClearTreeSearch"),
        treeNotFound: document.getElementById("treeNotFound"),
        btnExpandAll: document.getElementById("btnExpandAll"),
        btnCollapseAll: document.getElementById("btnCollapseAll"),
        treeViewContainer: document.getElementById("treeViewContainer"),
        catalogItemCount: document.getElementById("catalogItemCount"),

        // Top Navigation Bar
        btnModeDirect: document.getElementById("btnModeDirect"),
        btnModeSizer: document.getElementById("btnModeSizer"),
        btnUnitSI: document.getElementById("btnUnitSI"),
        btnUnitIP: document.getElementById("btnUnitIP"),
        btnResetDefault: document.getElementById("btnResetDefault"),

        // Fitting Header
        displayFittingTitle: document.getElementById("displayFittingTitle"),
        displayFittingSubtitle: document.getElementById("displayFittingSubtitle"),
        displayFittingCitation: document.getElementById("displayFittingCitation"),

        // Air Condition & Thermodynamic Properties Panel (McQuay Parity)
        airConditionPanel: document.getElementById("airConditionPanel"),
        selectAirCondition: document.getElementById("selectAirCondition"),
        valAirDensity: document.getElementById("valAirDensity"),
        valAirViscosity: document.getElementById("valAirViscosity"),
        valAirCp: document.getElementById("valAirCp"),
        valAirEnergyFactor: document.getElementById("valAirEnergyFactor"),

        // Sizing Banner
        sizingBanner: document.getElementById("sizingBanner"),
        sizeTargetType: document.getElementById("sizeTargetType"),
        sizeTargetVal: document.getElementById("sizeTargetVal"),
        lblTargetVal: document.getElementById("lblTargetVal"),
        sizeFixedType: document.getElementById("sizeFixedType"),
        sizeFixedDim: document.getElementById("sizeFixedDim"),
        lblFixedDim: document.getElementById("lblFixedDim"),

        // Auto Duct Sizer Position Controls & Shape Switchers
        sizerButtonCluster: document.getElementById("sizerButtonCluster"),
        sizerNavShapePills: document.getElementById("sizerNavShapePills"),
        btnNavRect: document.getElementById("btnNavRect"),
        btnNavRound: document.getElementById("btnNavRound"),
        sizerShapeBar: document.getElementById("sizerShapeBar"),
        btnHeaderRect: document.getElementById("btnHeaderRect"),
        btnHeaderRound: document.getElementById("btnHeaderRound"),

        // Tables
        inputTableBody: document.getElementById("inputTableBody"),
        outputTableBody: document.getElementById("outputTableBody"),
        btnCalculate: document.getElementById("btnCalculate"),
        btnDownloadCalcAction: document.getElementById("btnDownloadCalcAction"),
        btnResetSizer: document.getElementById("btnResetSizer"),

        // Output fields
        lblOutV: document.getElementById("lbl-out-v"),
        outV: document.getElementById("out-v"),
        rowOutV: document.getElementById("row-out-v"),
        lblOutFr: document.getElementById("lbl-out-fr"),
        outFr: document.getElementById("out-fr"),
        lblOutPv: document.getElementById("lbl-out-Pv"),
        outPv: document.getElementById("out-Pv"),
        lblOutF: document.getElementById("lbl-out-f"),
        outF: document.getElementById("out-f"),
        lblOutDp: document.getElementById("lbl-out-dp"),
        outDp: document.getElementById("out-dp"),

        // Sizing Extra Outputs
        rowOutSized: document.getElementById("row-out-sized"),
        lblOutSized: document.getElementById("lbl-out-sized"),
        outSized: document.getElementById("out-sized"),
        rowOutDe: document.getElementById("row-out-De"),
        lblOutDe: document.getElementById("lbl-out-De"),
        outDe: document.getElementById("out-De"),
        rowOutAR: document.getElementById("row-out-AR"),
        outAR: document.getElementById("out-AR"),
        rowOutArea: document.getElementById("row-out-area"),
        lblOutArea: document.getElementById("lbl-out-area"),
        outArea: document.getElementById("out-area"),
        rowOutRe: document.getElementById("row-out-re"),
        outRe: document.getElementById("out-re"),

        // Formulas Breakdown Panel & Fullscreen View
        formulasWrapper: document.getElementById("formulasWrapper"),
        formulasToggleHeader: document.getElementById("formulasToggleHeader"),
        fToggleArrow: document.getElementById("fToggleArrow"),
        formulasContainer: document.getElementById("formulasContainer"),
        btnCalcFullscreen: document.getElementById("btnCalcFullscreen"),
        calcFsTopBar: document.getElementById("calcFsTopBar"),
        calcFsTitleText: document.getElementById("calcFsTitleText"),
        calcFsCitationText: document.getElementById("calcFsCitationText"),
        btnCalcFsZoomOut: document.getElementById("btnCalcFsZoomOut"),
        btnCalcFsZoomReset: document.getElementById("btnCalcFsZoomReset"),
        btnCalcFsZoomIn: document.getElementById("btnCalcFsZoomIn"),
        btnCalcFsDownloadPdf: document.getElementById("btnCalcFsDownloadPdf"),
        btnExitCalcFullscreen: document.getElementById("btnExitCalcFullscreen"),

        // CAD Workspace & Fullscreen Controls
        mainContentPanel: document.querySelector(".main-content-panel"),
        drawingWorkspace: document.getElementById("drawingWorkspace"),
        cadToolbar: document.getElementById("cadToolbar"),
        btnToggleCalcPanel: document.getElementById("btnToggleCalcPanel"),
        lblToggleCalc: document.getElementById("lblToggleCalc"),
        btnFullscreenView: document.getElementById("btnFullscreenView"),
        btnToggleDiagramMode: document.getElementById("btnToggleDiagramMode"),
        lblDiagramMode: document.getElementById("lblDiagramMode"),

        // Fullscreen Dedicated Bar & Controls
        fullscreenTopBar: document.getElementById("fullscreenTopBar"),
        fsFittingName: document.getElementById("fsFittingName"),
        btnFsZoomOut: document.getElementById("btnFsZoomOut"),
        btnFsZoomReset: document.getElementById("btnFsZoomReset"),
        btnFsZoomIn: document.getElementById("btnFsZoomIn"),
        checkFsShowValues: document.getElementById("checkFsShowValues"),
        btnFsPrint: document.getElementById("btnFsPrint"),
        btnExitFullscreen: document.getElementById("btnExitFullscreen"),

        // Fullscreen HUD Summary
        fsHudSummary: document.getElementById("fsHudSummary"),
        fsHudQ: document.getElementById("fsHudQ"),
        fsHudV: document.getElementById("fsHudV"),
        fsHudPv: document.getElementById("fsHudPv"),
        fsHudF: document.getElementById("fsHudF"),
        fsHudDp: document.getElementById("fsHudDp"),

        // CAD Sheet & Viewport
        cadSheet: document.getElementById("cadSheet"),
        sheetTitleText: document.getElementById("sheetTitleText"),
        sheetSubtitleText: document.getElementById("sheetSubtitleText"),
        cadDrawingViewport: document.getElementById("cadDrawingViewport"),
        cadOfficialImg: document.getElementById("cadOfficialImg"),
        cadSvg: document.getElementById("cadSvg"),
        liveDimsBadge: document.getElementById("liveDimsBadge"),
        badgeContent: document.getElementById("badgeContent"),
        footerDate: document.getElementById("footerDate"),
        checkShowValues: document.getElementById("checkShowValues"),

        // ASHRAE Duct Fitting Code Guide Modal
        btnFittingCodeGuide: document.getElementById("btnFittingCodeGuide"),
        fittingCodeModal: document.getElementById("fittingCodeModal"),
        btnCloseCodeModal: document.getElementById("btnCloseCodeModal"),
        btnCloseCodeModalBottom: document.getElementById("btnCloseCodeModalBottom"),
        codeDecoderInput: document.getElementById("codeDecoderInput"),
        btnDecodeCurrent: document.getElementById("btnDecodeCurrent"),
        decoderResultChips: document.getElementById("decoderResultChips"),

        // ASHRAE Absolute Roughness Material Picker Modal
        roughnessModalBackdrop: document.getElementById("roughnessModalBackdrop"),
        roughnessModalWindow: document.getElementById("roughnessModalWindow"),
        roughnessModalTitle: document.getElementById("roughnessModalTitle"),
        btnCloseRoughnessModal: document.getElementById("btnCloseRoughnessModal"),
        roughnessListContainer: document.getElementById("roughnessListContainer"),
        btnSelectRoughness: document.getElementById("btnSelectRoughness"),
        btnCancelRoughness: document.getElementById("btnCancelRoughness"),

        // Project Management Ribbon & Actions
        projectRibbonBar: document.getElementById("projectRibbonBar"),
        selectActiveProject: document.getElementById("selectActiveProject"),
        btnAddNewProject: document.getElementById("btnAddNewProject"),
        btnManageAllProjects: document.getElementById("btnManageAllProjects"),
        btnProjectSummary: document.getElementById("btnProjectSummary"),
        badgeProjectFittingCount: document.getElementById("badgeProjectFittingCount"),
        snippetPrjCode: document.getElementById("snippetPrjCode"),
        snippetPrjClient: document.getElementById("snippetPrjClient"),
        btnAddToProject: document.getElementById("btnAddToProject"),

        // Searchable Project Combo Selector
        prjSearchCombo: document.getElementById("prjSearchCombo"),
        prjComboTrigger: document.getElementById("prjComboTrigger"),
        prjComboSelectedText: document.getElementById("prjComboSelectedText"),
        prjComboDropdown: document.getElementById("prjComboDropdown"),
        prjComboSearchInput: document.getElementById("prjComboSearchInput"),
        btnClearComboSearch: document.getElementById("btnClearComboSearch"),
        prjComboList: document.getElementById("prjComboList"),
        btnComboNewProject: document.getElementById("btnComboNewProject"),
        btnComboManageAll: document.getElementById("btnComboManageAll"),

        // Add New Project Modal
        newProjectModal: document.getElementById("newProjectModal"),
        btnCloseNewProjectModal: document.getElementById("btnCloseNewProjectModal"),
        btnCancelNewProject: document.getElementById("btnCancelNewProject"),
        btnSaveNewProject: document.getElementById("btnSaveNewProject"),
        inputPrjCode: document.getElementById("inputPrjCode"),
        inputPrjName: document.getElementById("inputPrjName"),
        inputPrjClient: document.getElementById("inputPrjClient"),
        inputPrjContractor: document.getElementById("inputPrjContractor"),
        inputPrjSubcontractor: document.getElementById("inputPrjSubcontractor"),
        inputPrjNotes: document.getElementById("inputPrjNotes"),

        // All Projects Modal
        allProjectsModal: document.getElementById("allProjectsModal"),
        btnCloseAllProjectsModal: document.getElementById("btnCloseAllProjectsModal"),
        btnCloseAllProjectsBottom: document.getElementById("btnCloseAllProjectsBottom"),
        btnAllProjectsCreateNew: document.getElementById("btnAllProjectsCreateNew"),
        inputFilterAllProjects: document.getElementById("inputFilterAllProjects"),
        btnClearFilterAllProjects: document.getElementById("btnClearFilterAllProjects"),
        allProjectsCount: document.getElementById("allProjectsCount"),
        tbodyAllProjects: document.getElementById("tbodyAllProjects"),

        // Edit Project Modal
        editProjectModal: document.getElementById("editProjectModal"),
        btnCloseEditProjectModal: document.getElementById("btnCloseEditProjectModal"),
        btnCancelEditProject: document.getElementById("btnCancelEditProject"),
        btnSaveEditProject: document.getElementById("btnSaveEditProject"),
        editPrjId: document.getElementById("editPrjId"),
        inputEditPrjCode: document.getElementById("inputEditPrjCode"),
        inputEditPrjName: document.getElementById("inputEditPrjName"),
        inputEditPrjClient: document.getElementById("inputEditPrjClient"),
        inputEditPrjContractor: document.getElementById("inputEditPrjContractor"),
        inputEditPrjSubcontractor: document.getElementById("inputEditPrjSubcontractor"),
        inputEditPrjNotes: document.getElementById("inputEditPrjNotes"),

        // Sidebar & Resizer
        catalogSidebar: document.getElementById("catalogSidebar"),
        catalogResizer: document.getElementById("catalogResizer"),

        // Project Summary Modal
        projectSummaryModal: document.getElementById("projectSummaryModal"),
        btnClosePrjSummaryModal: document.getElementById("btnClosePrjSummaryModal"),
        btnClosePrjSummaryBottom: document.getElementById("btnClosePrjSummaryBottom"),
        summaryValCode: document.getElementById("summaryValCode"),
        summaryValName: document.getElementById("summaryValName"),
        summaryValClient: document.getElementById("summaryValClient"),
        summaryValContractor: document.getElementById("summaryValContractor"),
        summaryValSubcontractor: document.getElementById("summaryValSubcontractor"),
        tabSummaryFittings: document.getElementById("tabSummaryFittings"),
        tabSummarySizer: document.getElementById("tabSummarySizer"),
        viewSummaryFittings: document.getElementById("viewSummaryFittings"),
        viewSummarySizer: document.getElementById("viewSummarySizer"),
        inputProjectDesignMargin: document.getElementById("inputProjectDesignMargin"),
        marginPresetChips: document.getElementById("marginPresetChips"),
        kpiTotalFittings: document.getElementById("kpiTotalFittings"),
        kpiSubtotalDp: document.getElementById("kpiSubtotalDp"),
        kpiTotalDp: document.getElementById("kpiTotalDp"),
        kpiTotalDpLabel: document.getElementById("kpiTotalDpLabel"),
        kpiTotalDpSub: document.getElementById("kpiTotalDpSub"),
        kpiMaxLoss: document.getElementById("kpiMaxLoss"),
        kpiTotalAirflow: document.getElementById("kpiTotalAirflow"),
        kpiSizerRuns: document.getElementById("kpiSizerRuns"),
        kpiSizerLength: document.getElementById("kpiSizerLength"),
        kpiSizerSubtotalDp: document.getElementById("kpiSizerSubtotalDp"),
        kpiSizerTotalDp: document.getElementById("kpiSizerTotalDp"),
        kpiSizerTotalDpLabel: document.getElementById("kpiSizerTotalDpLabel"),
        kpiSizerTotalDpSub: document.getElementById("kpiSizerTotalDpSub"),
        kpiSizerAvgRate: document.getElementById("kpiSizerAvgRate"),
        tableProjectSchedule: document.getElementById("tableProjectSchedule"),
        tbodyProjectSchedule: document.getElementById("tbodyProjectSchedule"),
        tfootProjectSchedule: document.getElementById("tfootProjectSchedule"),
        tableSizerSchedule: document.getElementById("tableSizerSchedule"),
        tbodySizerSchedule: document.getElementById("tbodySizerSchedule"),
        tfootSizerSchedule: document.getElementById("tfootSizerSchedule"),
        btnDownloadFitductPdf: document.getElementById("btnDownloadFitductPdf"),
        chkIncludeCalculations: document.getElementById("chkIncludeCalculations"),
        btnExportProjectCsv: document.getElementById("btnExportProjectCsv"),
        btnPrintProjectReport: document.getElementById("btnPrintProjectReport"),
        btnClearProjectFittings: document.getElementById("btnClearProjectFittings"),

        // Quick Add Fitting Dialog
        addFittingDialog: document.getElementById("addFittingDialog"),
        addFittingDialogTitle: document.getElementById("addFittingDialogTitle"),
        btnCloseAddFittingDialog: document.getElementById("btnCloseAddFittingDialog"),
        btnCancelAddFitting: document.getElementById("btnCancelAddFitting"),
        btnConfirmAddFitting: document.getElementById("btnConfirmAddFitting"),
        addFittingProjectTarget: document.getElementById("addFittingProjectTarget"),
        previewFittingName: document.getElementById("previewFittingName"),
        previewFittingStats: document.getElementById("previewFittingStats"),
        inputFittingTag: document.getElementById("inputFittingTag"),
        groupFittingQty: document.getElementById("groupFittingQty"),
        inputFittingQty: document.getElementById("inputFittingQty"),
        groupSizerLength: document.getElementById("groupSizerLength"),
        inputSizerLength: document.getElementById("inputSizerLength"),
        lblSizerLength: document.getElementById("lblSizerLength"),
        lblFittingNotes: document.getElementById("lblFittingNotes"),
        inputFittingNotes: document.getElementById("inputFittingNotes"),

        // Toast
        prjToastNotification: document.getElementById("prjToastNotification")
    };

    // --- Startup Initialization ---
    async function init() {
        setupGlobalListeners();
        setupProjectListeners();
        updateAirConditionUI();
        setTodayDate();
        await initProjectManager();
        await loadFittingsTree();
        if (window.location.search.includes("unit=IP")) {
            setUnit("IP");
        }
        if (window.location.search.includes("mode=sizer")) {
            const shape = window.location.search.includes("shape=round") ? "round" : "rect";
            setMode("sizer", shape);
        } else {
            selectFitting("CR11-1");
        }
        if (window.location.search.includes("modal=roughness")) {
            setTimeout(() => openRoughnessModal("e"), 300);
        }
        if (window.location.search.includes("modal=code")) {
            openFittingCodeModal("CR11-1");
        }
    }

    function setTodayDate() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        elements.footerDate.textContent = `${month}-${day}-${year}`;
    }

    // --- Load Catalog Tree from Backend ---
    async function loadFittingsTree() {
        try {
            const resp = await fetch("/api/tree");
            const res = await resp.json();
            if (res.status === "success") {
                state.catalogTree = res.data;
                renderTreeView(res.data);
                const total = countTreeItems(res.data);
                elements.catalogItemCount.textContent = `${total} Fittings in Database`;
            }
        } catch (err) {
            console.error("Failed to load catalog tree:", err);
            elements.treeViewContainer.innerHTML = `<div style="color:red;padding:8px;">Error loading fittings tree.</div>`;
        }
    }

    function countTreeItems(node) {
        let count = (node.items || []).length;
        for (const child of (node.children || [])) {
            count += countTreeItems(child);
        }
        return count;
    }

    // --- Render Windows-Style Hierarchical Tree ---
    function renderTreeView(treeData) {
        elements.treeViewContainer.innerHTML = "";
        const rootUl = document.createElement("ul");
        rootUl.className = "tree-root";

        (treeData.children || []).forEach(cat => {
            const catLi = createCategoryNode(cat, true);
            rootUl.appendChild(catLi);
        });

        elements.treeViewContainer.appendChild(rootUl);
    }

    function createCategoryNode(node, isExpandedByDefault) {
        const li = document.createElement("li");
        li.className = "tree-node";
        li.dataset.nodeId = node.id;

        const row = document.createElement("div");
        row.className = "tree-row tree-cat-row";
        row.title = node.name || "";

        const hasSub = (node.children && node.children.length > 0) || (node.items && node.items.length > 0);

        // Toggle button [+] or [-]
        const toggleBtn = document.createElement("span");
        toggleBtn.className = "tree-toggle-btn";
        toggleBtn.textContent = hasSub ? (isExpandedByDefault ? "−" : "+") : "";
        row.appendChild(toggleBtn);

        // Folder Icon
        const icon = document.createElement("span");
        icon.className = "tree-icon";
        icon.textContent = isExpandedByDefault ? "📂" : "📁";
        row.appendChild(icon);

        // Name
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = node.name;
        label.style.fontWeight = "bold";
        row.appendChild(label);

        li.appendChild(row);

        // Child Container
        const subUl = document.createElement("ul");
        subUl.className = "tree-branch";
        if (!isExpandedByDefault) {
            subUl.classList.add("hidden");
        }

        // Add subcategories
        (node.children || []).forEach(child => {
            // Supply Round and Common expanded by default
            const expandSub = isExpandedByDefault && (child.id === "supply_round" || child.id === "common_straight" || child.id === "supply_round_plenums");
            subUl.appendChild(createCategoryNode(child, expandSub));
        });

        // Add leaf fitting items
        (node.items || []).forEach(item => {
            subUl.appendChild(createItemNode(item));
        });

        li.appendChild(subUl);

        // Click handler to toggle folder
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = subUl.classList.toggle("hidden");
            toggleBtn.textContent = isHidden ? "+" : "−";
            icon.textContent = isHidden ? "📁" : "📂";
        });

        return li;
    }

    function createItemNode(item) {
        const li = document.createElement("li");
        li.className = "tree-node tree-leaf";
        li.dataset.code = item.code;

        const row = document.createElement("div");
        row.className = "tree-row tree-item-row";
        if (item.code === state.activeCode) {
            row.classList.add("selected");
        }
        // Full descriptive name & citation tooltip on row hover
        const fullTitle = formatFittingTitle(item);
        row.title = `${fullTitle}${item.citation ? ' (' + item.citation + ')' : ''}`;
        row.dataset.search = `${item.code} ${item.name || ''} ${item.tree_label || item.label || ''} ${item.title || ''}`.toLowerCase();

        // Spacer
        const spacer = document.createElement("span");
        spacer.className = "tree-toggle-spacer";
        row.appendChild(spacer);

        // Code Badge
        const codeBadge = document.createElement("span");
        codeBadge.className = "tree-code-badge";
        codeBadge.textContent = item.code;
        row.appendChild(codeBadge);

        // Item Label - exact match with ASHRAE database tree label
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = item.tree_label || item.label || item.name;
        label.title = fullTitle;
        row.appendChild(label);

        row.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".tree-row.selected").forEach(el => el.classList.remove("selected"));
            row.classList.add("selected");
            selectFitting(item.code);
        });

        li.appendChild(row);
        return li;
    }

    // --- Search & Filter Tree ---
    function filterTree(query) {
        const q = query.trim().toLowerCase();
        const allItems = elements.treeViewContainer ? elements.treeViewContainer.querySelectorAll(".tree-leaf") : [];
        
        if (elements.btnClearTreeSearch) {
            elements.btnClearTreeSearch.classList.toggle("hidden", !q);
        }

        if (!q) {
            // Reset visibility
            if (elements.treeViewContainer) {
                elements.treeViewContainer.querySelectorAll(".tree-node").forEach(n => n.classList.remove("hidden"));
            }
            if (elements.treeNotFound) {
                elements.treeNotFound.classList.add("hidden");
            }
            return;
        }

        let matchCount = 0;
        allItems.forEach(leaf => {
            const itemRow = leaf.querySelector(".tree-item-row");
            const searchStr = itemRow ? (itemRow.dataset.search || itemRow.textContent.toLowerCase()) : leaf.textContent.toLowerCase();
            const match = searchStr.includes(q);
            leaf.classList.toggle("hidden", !match);

            if (match) {
                matchCount++;
                // Ensure all ancestor branches are expanded and visible
                let parent = leaf.parentElement;
                while (parent && parent !== elements.treeViewContainer) {
                    if (parent.tagName === "UL") {
                        parent.classList.remove("hidden");
                        const prevRow = parent.previousElementSibling;
                        if (prevRow && prevRow.querySelector(".tree-toggle-btn")) {
                            prevRow.querySelector(".tree-toggle-btn").textContent = "−";
                            const icon = prevRow.querySelector(".tree-icon");
                            if (icon) icon.textContent = "📂";
                        }
                    }
                    if (parent.tagName === "LI") {
                        parent.classList.remove("hidden");
                    }
                    parent = parent.parentElement;
                }
            }
        });

        if (elements.treeNotFound) {
            if (matchCount === 0) {
                elements.treeNotFound.classList.remove("hidden");
                showPrjToast("Fitting Not Found");
            } else {
                elements.treeNotFound.classList.add("hidden");
            }
        }
    }

    function selectFittingFromSearch(query) {
        if (!query) return false;
        const rawQ = query.trim();
        if (!rawQ) return false;
        const q = rawQ.toLowerCase();
        const normQ = q.replace(/[\s\-_]/g, "");

        const allLeaves = elements.treeViewContainer ? elements.treeViewContainer.querySelectorAll(".tree-leaf") : [];
        if (!allLeaves.length) return false;

        let exactMatch = null;
        let normMatch = null;
        let prefixMatch = null;
        let firstVisible = null;
        let textMatch = null;

        for (const leaf of allLeaves) {
            const code = leaf.dataset.code || "";
            const lowerCode = code.toLowerCase();
            const normCode = lowerCode.replace(/[\s\-_]/g, "");
            const text = leaf.textContent.toLowerCase();
            const isVisible = !leaf.classList.contains("hidden");

            if (lowerCode === q) {
                exactMatch = code;
                break;
            }
            if (!normMatch && normCode === normQ) {
                normMatch = code;
            }
            if (!prefixMatch && (lowerCode.startsWith(q) || normCode.startsWith(normQ))) {
                prefixMatch = code;
            }
            if (!firstVisible && isVisible) {
                firstVisible = code;
            }
            if (!textMatch && text.includes(q)) {
                textMatch = code;
            }
        }

        const targetCode = exactMatch || normMatch || prefixMatch || firstVisible || textMatch;
        if (targetCode) {
            selectFitting(targetCode);
            const item = findItemInTree(state.catalogTree, targetCode);
            const itemName = item && item.name ? ` - ${item.name}` : "";
            showPrjToast(`✓ Selected Fitting: ${targetCode}${itemName}`);
            if (elements.treeNotFound) {
                elements.treeNotFound.classList.add("hidden");
            }
            if (elements.treeSearchInput) {
                elements.treeSearchInput.blur();
            }
            return true;
        } else {
            showPrjToast("Fitting Not Found");
            if (elements.treeNotFound) {
                elements.treeNotFound.classList.remove("hidden");
            }
        }
        return false;
    }

    function toggleAllFolders(expand) {
        elements.treeViewContainer.querySelectorAll(".tree-branch").forEach(ul => {
            ul.classList.toggle("hidden", !expand);
            const prevRow = ul.previousElementSibling;
            if (prevRow) {
                const btn = prevRow.querySelector(".tree-toggle-btn");
                if (btn) btn.textContent = expand ? "−" : "+";
                const icon = prevRow.querySelector(".tree-icon");
                if (icon) icon.textContent = expand ? "📂" : "📁";
            }
        });
    }

    // --- DuctFit Pro Fitting Catalog Area Enlarge & Resizer Logic ---
    function initCatalogEnlargeControls() {
        const sidebar = document.getElementById("catalogSidebar");
        const resizer = document.getElementById("catalogResizer");
        const btnToggle = document.getElementById("btnToggleCatalogWidth");
        const btnMini = document.getElementById("btnEnlargeCatalogBar");
        const iconToggle = document.getElementById("iconToggleCatalog");
        const textToggle = document.getElementById("textToggleCatalog");
        const iconMini = document.getElementById("iconEnlargeMini");
        const textMini = document.getElementById("textEnlargeMini");

        if (!sidebar) return;

        function updateButtonUI(enlarged) {
            const label = enlarged ? "Shrink" : "Enlarge";
            const icon = enlarged ? "◀️" : "↔️";
            const title = enlarged ? "Shrink catalog area to compact width (or drag divider bar)" : "Enlarge catalog area to wide view (or drag divider bar)";
            
            if (iconToggle) iconToggle.textContent = icon;
            if (textToggle) textToggle.textContent = label;
            if (btnToggle) {
                btnToggle.classList.toggle("is-enlarged", enlarged);
                btnToggle.title = title;
            }
            if (iconMini) iconMini.textContent = icon;
            if (textMini) textMini.textContent = label;
            if (btnMini) {
                btnMini.classList.toggle("is-enlarged", enlarged);
                btnMini.title = title;
            }
        }

        function setEnlarged(enlarge) {
            if (enlarge) {
                sidebar.classList.add("enlarged-catalog");
                sidebar.style.width = "580px";
                localStorage.setItem("fitduct_catalog_enlarged", "true");
                localStorage.setItem("fitduct_catalog_width", "580px");
                updateButtonUI(true);
            } else {
                sidebar.classList.remove("enlarged-catalog");
                sidebar.style.width = "320px";
                localStorage.setItem("fitduct_catalog_enlarged", "false");
                localStorage.setItem("fitduct_catalog_width", "320px");
                updateButtonUI(false);
            }
        }

        function toggleEnlarge() {
            const curWidth = parseInt(sidebar.style.width || "320", 10);
            const currentlyEnlarged = sidebar.classList.contains("enlarged-catalog") || curWidth > 420;
            setEnlarged(!currentlyEnlarged);
        }

        if (btnToggle) btnToggle.addEventListener("click", toggleEnlarge);
        if (btnMini) btnMini.addEventListener("click", toggleEnlarge);

        // Restore saved width or state from localStorage
        const savedWidth = localStorage.getItem("fitduct_catalog_width");
        const isEnlarged = localStorage.getItem("fitduct_catalog_enlarged") === "true";

        if (savedWidth) {
            const wVal = parseInt(savedWidth, 10);
            if (!isNaN(wVal) && wVal >= 240) {
                sidebar.style.width = wVal + "px";
                if (wVal >= 450) {
                    sidebar.classList.add("enlarged-catalog");
                    updateButtonUI(true);
                } else {
                    updateButtonUI(false);
                }
            }
        } else if (isEnlarged) {
            setEnlarged(true);
        }

        // Draggable Splitter Handle
        if (resizer) {
            let isDragging = false;
            let startX = 0;
            let startW = 0;

            resizer.addEventListener("mousedown", (e) => {
                e.preventDefault();
                isDragging = true;
                startX = e.clientX;
                startW = sidebar.getBoundingClientRect().width;
                sidebar.classList.add("resizing");
                resizer.classList.add("resizing");
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
            });

            document.addEventListener("mousemove", (e) => {
                if (!isDragging) return;
                const delta = e.clientX - startX;
                const minW = 240;
                const maxW = Math.max(minW, window.innerWidth - 320);
                const newW = Math.min(Math.max(startW + delta, minW), maxW);
                sidebar.style.width = newW + "px";
                const isWide = newW >= 450;
                sidebar.classList.toggle("enlarged-catalog", isWide);
                updateButtonUI(isWide);
            });

            document.addEventListener("mouseup", () => {
                if (!isDragging) return;
                isDragging = false;
                sidebar.classList.remove("resizing");
                resizer.classList.remove("resizing");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                const curW = parseInt(sidebar.style.width, 10);
                if (!isNaN(curW)) {
                    localStorage.setItem("fitduct_catalog_width", curW + "px");
                    localStorage.setItem("fitduct_catalog_enlarged", (curW >= 450).toString());
                }
            });

            // Double click splitter to toggle
            resizer.addEventListener("dblclick", () => {
                toggleEnlarge();
            });
        }
    }

    // --- Select Fitting Model from Tree or Sizer ---
    function selectFitting(code) {
        if (state.editingFitting && state.editingFitting.code !== code) {
            state.editingFitting = null;
        }
        state.activeCode = code;
        if (!code.startsWith("SIZE-")) {
            state.lastDirectCode = code;
        }
        const item = findItemInTree(state.catalogTree, code);
        state.activeItem = item || getFallbackItem(code);

        // Preload SVG blueprint immediately so switching to vector mode is 0ms
        let imgCode = code;
        if (imgCode === "SIZE-RECT") imgCode = "CR11-1";
        else if (imgCode === "SIZE-ROUND") imgCode = "CD11-1";
        else if (imgCode === "SD5-34") imgCode = "SD5-4";
        loadOfficialSvgBlueprint(imgCode);

        // Check if this is an automated sizing tool
        if (code.startsWith("SIZE-") || (state.activeItem && state.activeItem.category === "Duct Sizing")) {
            setMode("sizer");
        } else {
            state.userRoughnessValue = null;
            if (state.mode === "sizer") {
                setMode("direct");
            }
        }

        // Highlight selected node in tree & expand all ancestor folders
        if (elements.treeViewContainer) {
            document.querySelectorAll(".tree-row.selected").forEach(el => el.classList.remove("selected"));
            const leaf = elements.treeViewContainer.querySelector(`[data-code="${code}"]`);
            if (leaf) {
                let parent = leaf.parentElement;
                while (parent && parent !== elements.treeViewContainer) {
                    if (parent.tagName === "UL") {
                        parent.classList.remove("hidden");
                        const prevRow = parent.previousElementSibling;
                        if (prevRow && prevRow.querySelector(".tree-toggle-btn")) {
                            prevRow.querySelector(".tree-toggle-btn").textContent = "−";
                            const icon = prevRow.querySelector(".tree-icon");
                            if (icon) icon.textContent = "📂";
                        }
                    }
                    if (parent.tagName === "LI") {
                        parent.classList.remove("hidden");
                    }
                    parent = parent.parentElement;
                }
                leaf.classList.remove("hidden");
                const row = leaf.querySelector(".tree-row");
                if (row) row.classList.add("selected");
                leaf.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }

        updateHeaderAndInputs();
        calculate();
    }

    function findItemInTree(node, code) {
        if (!node) return null;
        for (const item of (node.items || [])) {
            if (item.code === code) return item;
        }
        for (const child of (node.children || [])) {
            const found = findItemInTree(child, code);
            if (found) return found;
        }
        return null;
    }

    function getFallbackItem(code) {
        if (code === "SIZE-ROUND" || code === "SIZE-RECT" || code === "SIZE-AUTO") {
            return {
                code: "SIZE-AUTO",
                name: "Auto Duct Sizer",
                citation: "ASHRAE Fundamentals, Ch. 21: Duct Design",
                shape: "rect",
                category: "Duct Sizing",
                drawing: "straight_rect",
                inputs: [
                    { id: "Q", label_si: "Airflow (Q, L/s)", label_ip: "Airflow (Q, cfm)", placeholder_si: "e.g. 300", placeholder_ip: "e.g. 636", step: 25 },
                    { id: "target_hf", label_si: "Head Loss Target (ΔP/L, Pa/m)", label_ip: "Head Loss Target (ΔP/L, in./100ft)", placeholder_si: "Project target (e.g. 0.80)", placeholder_ip: "Project target (e.g. 0.100)", step: 0.05 },
                    { id: "V", label_si: "Bulk Velocity (V, m/s)", label_ip: "Bulk Velocity (V, fpm)", placeholder_si: "e.g. 3.0", placeholder_ip: "e.g. 600", step: 0.1 },
                    { id: "De", label_si: "Equivalent Diameter (De, mm)", label_ip: "Equivalent Diameter (De, in.)", placeholder_si: "e.g. 356.8 (Auto)", placeholder_ip: "e.g. 14.0 (Auto)", step: 5 },
                    { id: "H", label_si: "Duct Height (H, mm)", label_ip: "Duct Height (H, in.)", placeholder_si: "Optional (e.g. 250)", placeholder_ip: "Optional (e.g. 10)", step: 25 },
                    { id: "W", label_si: "Duct Width (W, mm)", label_ip: "Duct Width (W, in.)", placeholder_si: "Optional (e.g. 400)", placeholder_ip: "Optional (e.g. 16)", step: 25 },
                    { id: "L", label_si: "Duct Length (L, m)", label_ip: "Duct Length (L, ft)", default_si: 1, default_ip: 10, step: 1 },
                    { id: "e", label_si: "Absolute Roughness (e, mm)", label_ip: "Absolute Roughness (e, ft)", default_si: "0.21336", default_ip: "0.00070", step: 0.001 },
                    { id: "rho", label_si: "Air Density (ρ, kg/m³)", label_ip: "Air Density (ρ, lbm/ft³)", default_si: "1.171", default_ip: "0.0731", step: 0.001 }
                ]
            };
        } else if (code === "CD11-1") {
            return {
                code: "CD11-1",
                name: "Straight Duct, Round (Colebrook 1939)",
                citation: "Colebrook 1939",
                shape: "round",
                inputs: [
                    { id: "D", label_si: "Diameter (D, mm)", label_ip: "Diameter (D, in.)", default_si: 300, default_ip: 12, step: 5 },
                    { id: "e", label_si: "Absolute Roughness (e, mm)", label_ip: "Absolute Roughness (e, ft)", default_si: 0.090, default_ip: 0.0003, step: 0.005 },
                    { id: "L", label_si: "Length (L, m)", label_ip: "Length (L, ft)", default_si: 3, default_ip: 10, step: 0.5 },
                    { id: "Q", label_si: "Flow Rate (Q, L/s)", label_ip: "Flow Rate (Q, cfm)", default_si: 2000, default_ip: 4238, step: 50 }
                ],
                drawing: "straight_round"
            };
        } else if (code === "CF11-1") {
            return {
                code: "CF11-1",
                name: "Straight Duct, Flat Oval (Heyt and Diaz 1975)",
                citation: "Heyt and Diaz 1975",
                shape: "oval",
                inputs: [
                    { id: "a", label_si: "Minor Axis (a, mm)", label_ip: "Minor Axis (a, in.)", default_si: 200, default_ip: 8, step: 10 },
                    { id: "A", label_si: "Major Axis (A, mm)", label_ip: "Major Axis (A, in.)", default_si: 400, default_ip: 16, step: 10 },
                    { id: "e", label_si: "Absolute Roughness (e, mm)", label_ip: "Absolute Roughness (e, ft)", default_si: 0.090, default_ip: 0.0003, step: 0.005 },
                    { id: "L", label_si: "Length (L, m)", label_ip: "Length (L, ft)", default_si: 3, default_ip: 10, step: 0.5 },
                    { id: "Q", label_si: "Flow Rate (Q, L/s)", label_ip: "Flow Rate (Q, cfm)", default_si: 2000, default_ip: 4238, step: 50 }
                ],
                drawing: "straight_oval"
            };
        }
        // Default CR11-1 (Official ASHRAE Database Standards)
        return {
            code: "CR11-1",
            name: "Straight Duct, Rectangular (Huebscher 1948)",
            citation: "Huebscher 1948",
            shape: "rect",
            inputs: [
                { id: "H", label_si: "Height (H, mm)", label_ip: "Height (H, in.)", default_si: 300, default_ip: 12, step: 10 },
                { id: "W", label_si: "Width (W, mm)", label_ip: "Width (W, in.)", default_si: 300, default_ip: 12, step: 10 },
                { id: "ei", label_si: "Absolute Roughness (e, mm)", label_ip: "Absolute Roughness (e, ft)", default_si: 0.090, default_ip: 0.0003, step: 0.001 },
                { id: "L", label_si: "Length (L, m)", label_ip: "Length (L, ft)", default_si: 1, default_ip: 10, step: 0.5 },
                { id: "Q", label_si: "Flow Rate (Q, L/s)", label_ip: "Flow Rate (Q, cfm)", default_si: 700, default_ip: 1500, step: 25 }
            ],
            output_details: [
                { variable: "V", prompt: "Velocity", si_unit: "(V, m/s)", ip_unit: "(V, fpm)", si_decimals: 1, ip_decimals: 0 },
                { variable: "Pv", prompt: "Vel Pres at V", si_unit: "(Pv, Pa)", ip_unit: "(Pv, in. wg)", si_decimals: 0, ip_decimals: 2 },
                { variable: "f", prompt: "Friction Factor", si_unit: "(f)", ip_unit: "(f)", si_decimals: 4, ip_decimals: 4 },
                { variable: "Po", prompt: "Pressure Loss", si_unit: "(Pa)", ip_unit: "(in. wg)", si_decimals: 1, ip_decimals: 2 }
            ],
            drawing: "straight_rect"
        };
    }

    // Helper: Safely format fitting code and name matching official ASHRAE format (e.g. "SD5-1  Wye, 45 Degree, Diverging")
    function formatFittingTitle(item) {
        if (!item) return "";
        if (typeof item === "string") return item;
        const code = (item.code || "").trim();
        let name = (item.title || item.name || "").trim();
        if (code && name.toLowerCase().startsWith(code.toLowerCase())) {
            name = name.slice(code.length).replace(/^[\s:\-]+/, '');
        }
        return code ? (name ? `${code}  ${name}` : code) : name;
    }

    // --- Update AUTO/ENTERED badges in Sizer mode ---
    function updateAutoBadges(autoField) {
        const rowH = document.getElementById("row-input-H");
        const rowW = document.getElementById("row-input-W");
        const inpH = document.getElementById("input-H");
        const inpW = document.getElementById("input-W");

        if (!autoField) {
            if (rowH && inpH) {
                const hLabel = rowH.querySelector(".col-label");
                if (hLabel) {
                    const oldBadge = hLabel.querySelector(".badge-dim-state");
                    if (oldBadge) oldBadge.remove();
                }
                inpH.style.borderColor = "";
                inpH.style.fontWeight = "";
                inpH.style.color = "";
            }
            if (rowW && inpW) {
                const wLabel = rowW.querySelector(".col-label");
                if (wLabel) {
                    const oldBadge = wLabel.querySelector(".badge-dim-state");
                    if (oldBadge) oldBadge.remove();
                }
                inpW.style.borderColor = "";
                inpW.style.fontWeight = "";
                inpW.style.color = "";
            }
            return;
        }

        if (rowH && inpH) {
            const hLabel = rowH.querySelector(".col-label");
            if (hLabel) {
                const oldBadge = hLabel.querySelector(".badge-dim-state");
                if (oldBadge) oldBadge.remove();
                if (autoField === "H") {
                    const badge = document.createElement("span");
                    badge.className = "badge-dim-state";
                    badge.style.cssText = "background:#fee2e2;color:#dc2626;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:800;margin-left:6px;border:1px solid #fca5a5;";
                    badge.textContent = "AUTO";
                    hLabel.appendChild(badge);
                    inpH.style.borderColor = "#dc2626";
                    inpH.style.fontWeight = "700";
                    inpH.style.color = "#dc2626";
                } else {
                    const badge = document.createElement("span");
                    badge.className = "badge-dim-state";
                    badge.style.cssText = "background:#f1f5f9;color:#64748b;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:6px;";
                    badge.textContent = "ENTERED";
                    hLabel.appendChild(badge);
                    inpH.style.borderColor = "";
                    inpH.style.fontWeight = "";
                    inpH.style.color = "";
                }
            }
        }

        if (rowW && inpW) {
            const wLabel = rowW.querySelector(".col-label");
            if (wLabel) {
                const oldBadge = wLabel.querySelector(".badge-dim-state");
                if (oldBadge) oldBadge.remove();
                if (autoField === "W") {
                    const badge = document.createElement("span");
                    badge.className = "badge-dim-state";
                    badge.style.cssText = "background:#fee2e2;color:#dc2626;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:800;margin-left:6px;border:1px solid #fca5a5;";
                    badge.textContent = "AUTO";
                    wLabel.appendChild(badge);
                    inpW.style.borderColor = "#dc2626";
                    inpW.style.fontWeight = "700";
                    inpW.style.color = "#dc2626";
                } else {
                    const badge = document.createElement("span");
                    badge.className = "badge-dim-state";
                    badge.style.cssText = "background:#f1f5f9;color:#64748b;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:6px;";
                    badge.textContent = "ENTERED";
                    wLabel.appendChild(badge);
                    inpW.style.borderColor = "";
                    inpW.style.fontWeight = "";
                    inpW.style.color = "";
                }
            }
        }
    }

    const standardOutputTableHTML = `
        <tr id="row-out-sized" class="hidden" style="background-color: #f0fdf4;">
            <td class="col-label" id="lbl-out-sized" style="font-weight: bold; color: #15803d;">Sized Duct Section</td>
            <td class="col-output" id="out-sized" style="font-weight: 800; font-size: 13px; color: #166534;">-</td>
        </tr>
        <tr id="row-out-v">
            <td class="col-label" id="lbl-out-v">Velocity (V, m/s)</td>
            <td class="col-output" id="out-v">-</td>
        </tr>
        <tr id="row-out-fr" class="row-loss-rate">
            <td class="col-label" id="lbl-out-fr">Friction Rate (Pa/m)</td>
            <td class="col-output" id="out-fr">-</td>
        </tr>
        <tr id="row-out-Pv">
            <td class="col-label" id="lbl-out-Pv">Vel Pres at V (Pv, Pa)</td>
            <td class="col-output" id="out-Pv">-</td>
        </tr>
        <tr id="row-out-f">
            <td class="col-label" id="lbl-out-f">Friction Factor (f)</td>
            <td class="col-output" id="out-f">-</td>
        </tr>
        <tr id="row-out-dp" class="row-highlight-loss">
            <td class="col-label" id="lbl-out-dp">Pressure Loss (Pa)</td>
            <td class="col-output" id="out-dp">-</td>
        </tr>
        <tr id="row-out-De">
            <td class="col-label" id="lbl-out-De">Equivalent Ø (De)</td>
            <td class="col-output" id="out-De">-</td>
        </tr>
        <tr id="row-out-AR">
            <td class="col-label">Aspect Ratio (W/H)</td>
            <td class="col-output" id="out-AR">-</td>
        </tr>
        <tr id="row-out-area">
            <td class="col-label" id="lbl-out-area">Flow Area</td>
            <td class="col-output" id="out-area">-</td>
        </tr>
        <tr id="row-out-re">
            <td class="col-label">Reynolds Number (Re)</td>
            <td class="col-output" id="out-re">-</td>
        </tr>
    `;

    function restoreStandardOutputTable() {
        if (!elements.outputTableBody) return;
        elements.outputTableBody.innerHTML = standardOutputTableHTML;
        elements.lblOutV = document.getElementById("lbl-out-v");
        elements.outV = document.getElementById("out-v");
        elements.rowOutV = document.getElementById("row-out-v");
        elements.lblOutFr = document.getElementById("lbl-out-fr");
        elements.outFr = document.getElementById("out-fr");
        elements.rowOutFr = document.getElementById("row-out-fr");
        elements.lblOutPv = document.getElementById("lbl-out-Pv");
        elements.outPv = document.getElementById("out-Pv");
        elements.lblOutF = document.getElementById("lbl-out-f");
        elements.outF = document.getElementById("out-f");
        elements.lblOutDp = document.getElementById("lbl-out-dp");
        elements.outDp = document.getElementById("out-dp");
        elements.rowOutSized = document.getElementById("row-out-sized");
        elements.lblOutSized = document.getElementById("lbl-out-sized");
        elements.outSized = document.getElementById("out-sized");
        elements.rowOutDe = document.getElementById("row-out-De");
        elements.lblOutDe = document.getElementById("lbl-out-De");
        elements.outDe = document.getElementById("out-De");
        elements.rowOutAR = document.getElementById("row-out-AR");
        elements.outAR = document.getElementById("out-AR");
        elements.lblOutArea = document.getElementById("lbl-out-area");
        elements.outArea = document.getElementById("out-area");
        elements.rowOutRe = document.getElementById("row-out-re");
        elements.outRe = document.getElementById("out-re");
    }

    // --- Clear All Sizer Outputs to Blank State ---
    function clearSizerOutputs() {
        if (!document.getElementById("out-sized") || !elements.outSized) {
            restoreStandardOutputTable();
        }
        if (elements.outSized) elements.outSized.textContent = "-";
        if (elements.outV) elements.outV.textContent = "-";
        if (elements.outFr) elements.outFr.textContent = "-";
        if (elements.outPv) elements.outPv.textContent = "-";
        if (elements.outF) elements.outF.textContent = "-";
        if (elements.outDp) elements.outDp.textContent = "-";
        if (elements.outDe) elements.outDe.textContent = "-";
        if (elements.outAR) elements.outAR.textContent = "-";
        if (elements.outArea) elements.outArea.textContent = "-";
        if (elements.outRe) elements.outRe.textContent = "-";
        updateAutoBadges(null);
        if (elements.formulasContainer) {
            elements.formulasContainer.innerHTML = `<div class="tb-empty-note" style="padding:18px;text-align:center;color:#64748b;font-style:italic;">Enter airflow (Q) and head loss target or velocity to view engineering calculation breakdown.</div>`;
        }
        updateSizerTargetCitation();
    }

    // --- Clear All Fitting Outputs to Blank State ---
    function clearFittingOutputs() {
        const item = state.activeItem || getFallbackItem(state.activeCode);
        const u = state.unit;

        if (item && item.output_details && item.output_details.length > 0) {
            elements.outputTableBody.innerHTML = "";
            item.output_details.forEach(od => {
                const prompt = od.prompt || od.variable;
                const match = prompt.match(/^\{([^}]+)\}(.*)$/);
                if (match) {
                    const sectionTitle = match[1];
                    const secTr = document.createElement("tr");
                    secTr.className = "row-section-header";
                    secTr.style.background = "#e2e8f0";
                    secTr.style.borderTop = "1px solid #cbd5e1";
                    secTr.style.borderBottom = "1px solid #cbd5e1";
                    secTr.innerHTML = `<td colspan="2" style="text-align:center; color:#0f172a; font-weight:700; padding:6px 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.75px;">${escapeHtml(sectionTitle)}</td>`;
                    elements.outputTableBody.appendChild(secTr);
                }

                const cleanPrompt = match ? match[2].trim() : prompt.trim();
                const unitStr = u === "SI" ? (od.si_unit || "") : (od.ip_unit || "");
                const labelText = unitStr ? `${cleanPrompt} ${unitStr}` : cleanPrompt;

                const tr = document.createElement("tr");
                tr.id = `row-out-${od.variable}`;
                const tdPrompt = document.createElement("td");
                tdPrompt.className = "col-label";
                tdPrompt.textContent = labelText;

                const tdVal = document.createElement("td");
                tdVal.className = "col-output";
                tdVal.id = `out-${od.variable}`;
                tdVal.textContent = "";

                tr.appendChild(tdPrompt);
                tr.appendChild(tdVal);
                elements.outputTableBody.appendChild(tr);
            });
        } else {
            restoreStandardOutputTable();
            if (elements.outSized) elements.outSized.textContent = "";
            if (elements.outV) elements.outV.textContent = "";
            if (elements.outFr) elements.outFr.textContent = "";
            if (elements.outPv) elements.outPv.textContent = "";
            if (elements.outF) elements.outF.textContent = "";
            if (elements.outDp) elements.outDp.textContent = "";
            if (elements.outDe) elements.outDe.textContent = "";
            if (elements.outAR) elements.outAR.textContent = "";
            if (elements.outArea) elements.outArea.textContent = "";
            if (elements.outRe) elements.outRe.textContent = "";
        }

        if (elements.formulasContainer) {
            elements.formulasContainer.innerHTML = `<div class="tb-empty-note" style="padding:18px;text-align:center;color:#64748b;font-style:italic;">Enter fitting input parameters to view step-by-step engineering calculation breakdown.</div>`;
        }
    }

    // --- Update Air Condition UI (McQuay Parity) ---
    function updateAirConditionUI() {
        const condId = state.selectedAirConditionId || "comfort_return";
        const cond = AIR_CONDITIONS[condId] || AIR_CONDITIONS["comfort_return"];
        const isSI = state.unit === "SI";

        if (elements.selectAirCondition) {
            elements.selectAirCondition.value = condId;
            Array.from(elements.selectAirCondition.options).forEach(opt => {
                const c = AIR_CONDITIONS[opt.value];
                if (c) {
                    opt.textContent = isSI ? c.name_si : c.name_ip;
                }
            });
        }

        if (elements.valAirDensity) {
            elements.valAirDensity.textContent = isSI
                ? `${cond.density_si.toFixed(3)} kg/m³`
                : `${cond.density_ip.toFixed(4)} lbm/ft³`;
        }
        if (elements.valAirViscosity) {
            elements.valAirViscosity.textContent = isSI
                ? `${cond.viscosity_si.toFixed(4)} kg/m·h`
                : `${cond.viscosity_ip.toFixed(4)} lbm/ft·h`;
        }
        if (elements.valAirCp) {
            elements.valAirCp.textContent = isSI
                ? `${cond.cp_si.toFixed(4)} kJ/kg·°C`
                : `${cond.cp_ip.toFixed(4)} Btu/lbm·°F`;
        }
        if (elements.valAirEnergyFactor) {
            elements.valAirEnergyFactor.textContent = isSI
                ? `${cond.energy_factor_si.toFixed(2)} W/°C·L/s`
                : `${cond.energy_factor_ip.toFixed(2)} Btu/h·°F·cfm`;
        }

        // Sync input-rho field in the table ONLY if in Auto Duct Sizer mode
        // In Fitting Loss Analysis, rho is governed strictly by the official ASHRAE Database (1.204 SI / 0.075 IP)
        if (state.mode === "sizer" || (state.activeCode && state.activeCode.startsWith("SIZE-"))) {
            const rhoInput = document.getElementById("input-rho");
            if (rhoInput && document.activeElement !== rhoInput) {
                rhoInput.value = isSI ? cond.density_si.toFixed(3) : cond.density_ip.toFixed(4);
            }
        }
    }

    // --- Authoritative ASHRAE & McQuay Core Citation ---
    function updateSizerTargetCitation() {
        if (state.mode !== "sizer" && (!state.activeCode || !state.activeCode.startsWith("SIZE-"))) {
            return;
        }
        if (elements.displayFittingCitation) {
            elements.displayFittingCitation.textContent = "Colebrook-Darcy Friction (Eq. 19) & Huebscher Equivalent Diameter (Eq. 25)";
        }
        if (elements.displayFittingSubtitle) {
            elements.displayFittingSubtitle.textContent = "ASHRAE Fundamentals, Ch. 21: Duct Design";
        }
        if (elements.sheetSubtitleText) {
            elements.sheetSubtitleText.textContent = "ASHRAE Fundamentals, Ch. 21: Duct Design";
        }
    }

    // --- Dedicated Sizer Bi-directional Solver (Exact McQuay Parity) ---
    function solveDuctSizer(fieldId) {
        const u = state.unit;
        const getNum = (id) => {
            const el = document.getElementById(`input-${id}`);
            if (!el || el.value.trim() === "") return NaN;
            const v = parseFloat(el.value);
            return isNaN(v) ? NaN : v;
        };
        const setNum = (id, val, decimals = 1) => {
            const el = document.getElementById(`input-${id}`);
            if (el && document.activeElement !== el && !isNaN(val) && isFinite(val) && val > 0) {
                if (Number.isInteger(val)) {
                    el.value = val.toString();
                } else {
                    el.value = (Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals).replace(/\.0+$/, '');
                }
                if (!state.userSizerValues) state.userSizerValues = {};
                state.userSizerValues[id] = el.value;
            }
        };

        let Q = getNum("Q");
        if (isNaN(Q) || Q <= 0) {
            clearSizerOutputs();
            return;
        }

        const targetHfVal = getNum("target_hf");
        const targetVVal = getNum("V");
        const deVal = getNum("De");
        const hVal = getNum("H");
        const wVal = getNum("W");

        const hasConstraint = !isNaN(targetHfVal) || !isNaN(targetVVal) || !isNaN(deVal) || !isNaN(hVal) || !isNaN(wVal);
        if (!hasConstraint) {
            clearSizerOutputs();
            return;
        }

        const cond = AIR_CONDITIONS[state.selectedAirConditionId] || AIR_CONDITIONS["comfort_return"];
        const Qm3s = u === "SI" ? Q / 1000.0 : Q * 0.0004719474;
        const rawE = getNum("e");
        const eMm = !isNaN(rawE) ? (u === "SI" ? rawE : rawE * 304.8) : (u === "SI" ? 0.21336 : 0.00070 * 304.8);
        const eM = eMm / 1000.0;
        const rawRho = getNum("rho");
        const rho = !isNaN(rawRho) ? (u === "SI" ? rawRho : rawRho * 16.018463) : cond.density_si;
        const muPas = cond.viscosity_pas;
        const rhoRef = 1.204;
        const densityCorr = (rho > 0) ? (rhoRef / rho) : 1.0;
        const stepUnits = u === "SI" ? 25 : 1;

        // Track driving constraint
        if (fieldId === "V") {
            state.lastConstraint = "V";
            const typedV = getNum("V");
            if (!isNaN(typedV) && typedV > 0) state.targetV = typedV;
        } else if (fieldId === "target_hf") {
            state.lastConstraint = "friction";
            const typedHf = getNum("target_hf");
            if (!isNaN(typedHf) && typedHf > 0) state.targetHf = typedHf;
        } else if (fieldId === "De") {
            state.lastConstraint = "De";
        } else if (fieldId === "H") {
            state.lastChanged = "H";
        } else if (fieldId === "W") {
            state.lastChanged = "W";
        }

        let DcircMm = 300.0;
        let DcircM = 0.300;

        if (state.lastConstraint === "V") {
            let targetV = getNum("V");
            if (isNaN(targetV) || targetV <= 0) targetV = u === "SI" ? 3.0 : 600;
            const Vms = u === "SI" ? targetV : targetV / 196.85;
            const Aflow = Qm3s / Math.max(Vms, 1e-6);
            DcircM = Math.sqrt(4.0 * Aflow / Math.PI);
            DcircMm = DcircM * 1000.0;
            setNum("De", u === "SI" ? DcircMm : DcircMm / 25.4, 1);

            // Colebrook-Darcy loss at continuous equivalent diameter
            const Re = (rho * Vms * DcircM) / muPas;
            let f = 0.02;
            for (let j = 0; j < 15; j++) {
                const invF = -2.0 * Math.log10(eM / (3.7 * DcircM) + 2.51 / (Re * Math.sqrt(f)));
                f = 1.0 / (invF * invF);
            }
            const Pv = 0.5 * rho * Vms * Vms;
            const hfPam = f * (1.0 / DcircM) * Pv * densityCorr;
            const hfUnit = u === "SI" ? hfPam : hfPam * (30.48 / 249.0889);
            setNum("target_hf", hfUnit, 2);
        } else if (state.lastConstraint === "De") {
            let targetDe = getNum("De");
            if (isNaN(targetDe) || targetDe <= 0) targetDe = u === "SI" ? 355 : 14;
            DcircMm = u === "SI" ? targetDe : targetDe * 25.4;
            DcircM = DcircMm / 1000.0;
            const Aflow = Math.PI * Math.pow(DcircM / 2.0, 2);
            const Vms = Qm3s / Math.max(Aflow, 1e-6);
            setNum("V", u === "SI" ? Vms : Vms * 196.85, 1);

            const Re = (rho * Vms * DcircM) / muPas;
            let f = 0.02;
            for (let j = 0; j < 15; j++) {
                const invF = -2.0 * Math.log10(eM / (3.7 * DcircM) + 2.51 / (Re * Math.sqrt(f)));
                f = 1.0 / (invF * invF);
            }
            const Pv = 0.5 * rho * Vms * Vms;
            const hfPam = f * (1.0 / DcircM) * Pv * densityCorr;
            const hfUnit = u === "SI" ? hfPam : hfPam * (30.48 / 249.0889);
            setNum("target_hf", hfUnit, 2);
        } else {
            let targetHf = getNum("target_hf");
            if (isNaN(targetHf) || targetHf <= 0) targetHf = u === "SI" ? 0.80 : 0.100;
            const targetHfPam = u === "SI" ? targetHf : targetHf * (249.0889 / 30.48);

            // Solve target circular diameter Dcirc (m) via binary search
            let lowD = 0.04, highD = 3.5;
            for (let i = 0; i < 40; i++) {
                const midD = 0.5 * (lowD + highD);
                const A = Math.PI * Math.pow(midD / 2.0, 2);
                const V = Qm3s / A;
                const Re = (rho * V * midD) / muPas;
                let f = 0.02;
                for (let j = 0; j < 15; j++) {
                    const invF = -2.0 * Math.log10(eM / (3.7 * midD) + 2.51 / (Re * Math.sqrt(f)));
                    f = 1.0 / (invF * invF);
                }
                const Pv = 0.5 * rho * V * V;
                const hf = f * (1.0 / midD) * Pv * densityCorr;
                if (hf > targetHfPam) lowD = midD;
                else highD = midD;
            }
            DcircM = 0.5 * (lowD + highD);
            DcircMm = DcircM * 1000.0;
            setNum("De", u === "SI" ? DcircMm : DcircMm / 25.4, 1);
            const aFlow = Math.PI * Math.pow(DcircM / 2.0, 2);
            const curV = Qm3s / aFlow;
            setNum("V", u === "SI" ? curV : curV * 196.85, 1);
        }

        // Rectangular dimension solving via Huebscher if H or W has been touched
        if (fieldId === "H" || (state.lastChanged === "H" && !isNaN(hVal) && hVal > 0)) {
            const Hval = getNum("H");
            if (!isNaN(Hval) && Hval > 0) {
                const Hmm = u === "SI" ? Hval : Hval * 25.4;
                let lowW = 10.0, highW = 5000.0;
                for (let i = 0; i < 35; i++) {
                    const midW = 0.5 * (lowW + highW);
                    const de = 1.30 * Math.pow(Hmm * midW, 0.625) / Math.pow(Hmm + midW, 0.25);
                    if (de < DcircMm) lowW = midW;
                    else highW = midW;
                }
                const exactW = 0.5 * (lowW + highW);
                const nomW = u === "SI" ? Math.max(stepUnits, Math.round(exactW / stepUnits) * stepUnits) : Math.max(stepUnits, Math.round((exactW / 25.4) / stepUnits) * stepUnits);
                setNum("W", nomW, 0);
            }
        } else if (fieldId === "W" || (state.lastChanged === "W" && !isNaN(wVal) && wVal > 0)) {
            const Wval = getNum("W");
            if (!isNaN(Wval) && Wval > 0) {
                const Wmm = u === "SI" ? Wval : Wval * 25.4;
                let lowH = 10.0, highH = 5000.0;
                for (let i = 0; i < 35; i++) {
                    const midH = 0.5 * (lowH + highH);
                    const de = 1.30 * Math.pow(Wmm * midH, 0.625) / Math.pow(Wmm + midH, 0.25);
                    if (de < DcircMm) lowH = midH;
                    else highH = midH;
                }
                const exactH = 0.5 * (lowH + highH);
                const nomH = u === "SI" ? Math.max(stepUnits, Math.round(exactH / stepUnits) * stepUnits) : Math.max(stepUnits, Math.round((exactH / 25.4) / stepUnits) * stepUnits);
                setNum("H", nomH, 0);
            }
        }
    }

    // --- Bi-directional Multi-Way Continuity Solving (Q = A * V) ---
    function solveTwoValues(fieldId) {
        const item = state.activeItem;
        if (!item) return;
        const isSizer = state.mode === "sizer" || (item.code && item.code.startsWith("SIZE-"));
        if (isSizer) {
            solveDuctSizer(fieldId);
            updateSizerTargetCitation();
            return;
        }

        // In Fitting Loss Analysis mode, all input parameters (such as Wind Velocity V in SD2-2/SR2-2)
        // are independent user-specified boundary conditions from the official ASHRAE database.
        // Never overwrite user inputs in fitting loss mode.
        return;

        const u = state.unit;
        const code = item.code || "";
        const shape = item.shape || "rect";

        const getNum = (id) => {
            const el = document.getElementById(`input-${id}`);
            if (!el || el.value.trim() === "") return NaN;
            const v = parseFloat(el.value);
            return isNaN(v) ? NaN : v;
        };

        const setNum = (id, val, decimals = 1) => {
            const el = document.getElementById(`input-${id}`);
            if (el && !isNaN(val) && isFinite(val) && val > 0) {
                if (Number.isInteger(val)) {
                    el.value = val.toString();
                } else {
                    el.value = (Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals).replace(/\.0+$/, '');
                }
            }
        };

        if (shape === "rect" || code === "CR11-1") {
            let H = getNum("H");
            let W = getNum("W");
            let Q = getNum("Q");
            let V = getNum("V");

            if (fieldId === "V") {
                if (!isNaN(V) && V > 0) {
                    if (!isNaN(Q) && Q > 0) {
                        if (!isNaN(H) && H > 0) {
                            const solvedW = u === "SI" ? (Q * 1000.0) / (H * V) : (144.0 * Q) / (H * V);
                            setNum("W", solvedW, 1);
                        } else if (!isNaN(W) && W > 0) {
                            const solvedH = u === "SI" ? (Q * 1000.0) / (W * V) : (144.0 * Q) / (W * V);
                            setNum("H", solvedH, 1);
                        } else {
                            const solvedSide = u === "SI" ? Math.sqrt((Q * 1000.0) / V) : Math.sqrt((144.0 * Q) / V);
                            setNum("H", solvedSide, 1);
                            setNum("W", solvedSide, 1);
                        }
                    } else if (!isNaN(H) && H > 0 && !isNaN(W) && W > 0) {
                        const solvedQ = u === "SI" ? (H * W * V) / 1000.0 : (H * W * V) / 144.0;
                        setNum("Q", solvedQ, 1);
                    }
                }
            } else if (fieldId === "Q") {
                if (!isNaN(Q) && Q > 0) {
                    if (!isNaN(H) && H > 0 && !isNaN(W) && W > 0) {
                        const solvedV = u === "SI" ? (Q * 1000.0) / (H * W) : (144.0 * Q) / (H * W);
                        setNum("V", solvedV, 1);
                        if (elements.outV) elements.outV.textContent = u === "SI" ? solvedV.toFixed(1) : Math.round(solvedV).toLocaleString();
                    } else if (!isNaN(V) && V > 0 && !isNaN(H) && H > 0) {
                        const solvedW = u === "SI" ? (Q * 1000.0) / (H * V) : (144.0 * Q) / (H * V);
                        setNum("W", solvedW, 1);
                    } else if (!isNaN(V) && V > 0 && !isNaN(W) && W > 0) {
                        const solvedH = u === "SI" ? (Q * 1000.0) / (W * V) : (144.0 * Q) / (W * V);
                        setNum("H", solvedH, 1);
                    }
                }
            } else if (fieldId === "H" || fieldId === "W") {
                H = getNum("H");
                W = getNum("W");
                if (!isNaN(H) && H > 0 && !isNaN(W) && W > 0) {
                    if (!isNaN(Q) && Q > 0) {
                        const solvedV = u === "SI" ? (Q * 1000.0) / (H * W) : (144.0 * Q) / (H * W);
                        setNum("V", solvedV, 1);
                        if (elements.outV) elements.outV.textContent = u === "SI" ? solvedV.toFixed(1) : Math.round(solvedV).toLocaleString();
                    } else if (!isNaN(V) && V > 0) {
                        const solvedQ = u === "SI" ? (H * W * V) / 1000.0 : (H * W * V) / 144.0;
                        setNum("Q", solvedQ, 1);
                    }
                }
            }
        } else if (shape === "round" || code === "CD11-1" || code === "CD11-2") {
            let D = getNum("D");
            let Q = getNum("Q");
            let V = getNum("V");

            if (fieldId === "V") {
                if (!isNaN(V) && V > 0) {
                    if (!isNaN(Q) && Q > 0) {
                        const solvedD = u === "SI" ? Math.sqrt((4000.0 * Q) / (Math.PI * V)) : Math.sqrt((576.0 * Q) / (Math.PI * V));
                        setNum("D", solvedD, 1);
                    } else if (!isNaN(D) && D > 0) {
                        const solvedQ = u === "SI" ? (Math.PI * (D ** 2) * V) / 4000.0 : (Math.PI * (D ** 2) * V) / 576.0;
                        setNum("Q", solvedQ, 1);
                    }
                }
            } else if (fieldId === "Q") {
                if (!isNaN(Q) && Q > 0) {
                    if (!isNaN(D) && D > 0) {
                        const solvedV = u === "SI" ? (4000.0 * Q) / (Math.PI * (D ** 2)) : (576.0 * Q) / (Math.PI * (D ** 2));
                        setNum("V", solvedV, 1);
                        if (elements.outV) elements.outV.textContent = u === "SI" ? solvedV.toFixed(1) : Math.round(solvedV).toLocaleString();
                    } else if (!isNaN(V) && V > 0) {
                        const solvedD = u === "SI" ? Math.sqrt((4000.0 * Q) / (Math.PI * V)) : Math.sqrt((576.0 * Q) / (Math.PI * V));
                        setNum("D", solvedD, 1);
                    }
                }
            } else if (fieldId === "D") {
                if (!isNaN(D) && D > 0) {
                    if (!isNaN(Q) && Q > 0) {
                        const solvedV = u === "SI" ? (4000.0 * Q) / (Math.PI * (D ** 2)) : (576.0 * Q) / (Math.PI * (D ** 2));
                        setNum("V", solvedV, 1);
                        if (elements.outV) elements.outV.textContent = u === "SI" ? solvedV.toFixed(1) : Math.round(solvedV).toLocaleString();
                    } else if (!isNaN(V) && V > 0) {
                        const solvedQ = u === "SI" ? (Math.PI * (D ** 2) * V) / 4000.0 : (Math.PI * (D ** 2) * V) / 576.0;
                        setNum("Q", solvedQ, 1);
                    }
                }
            }
        } else if (shape === "oval" || code === "CF11-1") {
            let a = getNum("a");
            let A = getNum("A");
            let Q = getNum("Q");
            let V = getNum("V");

            if (fieldId === "V") {
                if (!isNaN(V) && V > 0) {
                    if (!isNaN(Q) && Q > 0 && !isNaN(a) && a > 0) {
                        if (u === "SI") {
                            const Ac_mm2 = (Q * 1000.0) / V;
                            const solvedA = (Ac_mm2 - (Math.PI * (a ** 2) / 4.0)) / a + a;
                            setNum("A", solvedA, 1);
                        } else {
                            const Ac_sqin = (144.0 * Q) / V;
                            const solvedA = (Ac_sqin - (Math.PI * (a ** 2) / 4.0)) / a + a;
                            setNum("A", solvedA, 1);
                        }
                    } else if (!isNaN(a) && a > 0 && !isNaN(A) && A > 0) {
                        if (u === "SI") {
                            const Ac_m2 = ((Math.PI * (a ** 2) / 4.0) + a * (A - a)) / 1e6;
                            const solvedQ = Ac_m2 * V * 1000.0;
                            setNum("Q", solvedQ, 1);
                        } else {
                            const Ac_sqin = (Math.PI * (a ** 2) / 4.0) + a * (A - a);
                            const solvedQ = (Ac_sqin * V) / 144.0;
                            setNum("Q", solvedQ, 1);
                        }
                    }
                }
            } else if (fieldId === "Q") {
                if (!isNaN(Q) && Q > 0 && !isNaN(a) && a > 0 && !isNaN(A) && A > 0) {
                    if (u === "SI") {
                        const Ac_m2 = ((Math.PI * (a ** 2) / 4.0) + a * (A - a)) / 1e6;
                        const solvedV = (Q / 1000.0) / Ac_m2;
                        setNum("V", solvedV, 1);
                        if (elements.outV) elements.outV.textContent = u === "SI" ? solvedV.toFixed(1) : Math.round(solvedV).toLocaleString();
                    } else {
                        const Ac_sqin = (Math.PI * (a ** 2) / 4.0) + a * (A - a);
                        const solvedV = (144.0 * Q) / Ac_sqin;
                        setNum("V", solvedV, 1);
                        if (elements.outV) elements.outV.textContent = Math.round(solvedV).toLocaleString();
                    }
                }
            } else if (fieldId === "a" || fieldId === "A") {
                a = getNum("a");
                A = getNum("A");
                if (!isNaN(a) && a > 0 && !isNaN(A) && A > 0) {
                    if (!isNaN(Q) && Q > 0) {
                        if (u === "SI") {
                            const Ac_m2 = ((Math.PI * (a ** 2) / 4.0) + a * (A - a)) / 1e6;
                            const solvedV = (Q / 1000.0) / Ac_m2;
                            setNum("V", solvedV, 1);
                            if (elements.outV) elements.outV.textContent = u === "SI" ? solvedV.toFixed(1) : Math.round(solvedV).toLocaleString();
                        } else {
                            const Ac_sqin = (Math.PI * (a ** 2) / 4.0) + a * (A - a);
                            const solvedV = (144.0 * Q) / Ac_sqin;
                            setNum("V", solvedV, 1);
                            if (elements.outV) elements.outV.textContent = Math.round(solvedV).toLocaleString();
                        }
                    } else if (!isNaN(V) && V > 0) {
                        if (u === "SI") {
                            const Ac_m2 = ((Math.PI * (a ** 2) / 4.0) + a * (A - a)) / 1e6;
                            const solvedQ = Ac_m2 * V * 1000.0;
                            setNum("Q", solvedQ, 1);
                        } else {
                            const Ac_sqin = (Math.PI * (a ** 2) / 4.0) + a * (A - a);
                            const solvedQ = (Ac_sqin * V) / 144.0;
                            setNum("Q", solvedQ, 1);
                        }
                    }
                }
            }
        }
    }

    // Helper: Compute hierarchy breadcrumb path for active fitting
    function getItemHierarchyBreadcrumb(node, code, path = []) {
        if (!node) return null;
        const curName = node.name || node.title;
        const curPath = curName ? [...path, curName] : path;
        for (const item of (node.items || [])) {
            if (item.code === code) {
                return curPath;
            }
        }
        for (const child of (node.children || [])) {
            const found = getItemHierarchyBreadcrumb(child, code, curPath);
            if (found) return found;
        }
        return null;
    }

    // --- Update Header and Input Table ---
    function updateHeaderAndInputs(convertedValues = {}) {
        const item = state.activeItem;
        const u = state.unit;
        const isSizer = state.mode === "sizer" || (item && item.code && item.code.startsWith("SIZE-"));
        const cond = AIR_CONDITIONS[state.selectedAirConditionId] || AIR_CONDITIONS["comfort_return"];

        // Air Condition Panel: Only for Auto Duct Sizer (McQuay Parity)
        if (elements.airConditionPanel) {
            elements.airConditionPanel.classList.toggle("hidden", !isSizer);
        }
        // Formula Breakdown: Enabled for BOTH Fitting Loss Analysis AND Auto Duct Sizer
        if (elements.formulasWrapper) {
            elements.formulasWrapper.classList.remove("hidden");
        }

        // Sizer Shape Nav Pills & Header Bar Visibility
        if (elements.sizerNavShapePills) {
            elements.sizerNavShapePills.classList.toggle("hidden", !isSizer);
        }
        if (elements.sizerShapeBar) {
            elements.sizerShapeBar.classList.toggle("hidden", !isSizer);
        }

        let inputs = [];

        if (isSizer) {
            elements.displayFittingTitle.textContent = "Auto Duct Sizer";
            elements.displayFittingSubtitle.textContent = "ASHRAE Fundamentals, Ch. 21: Duct Design";
            elements.displayFittingCitation.textContent = "Colebrook-Darcy Friction (Eq. 19) & Huebscher Equivalent Diameter (Eq. 25)";
            elements.sheetTitleText.textContent = "Auto Duct Sizer";
            elements.sheetSubtitleText.textContent = "ASHRAE Fundamentals, Ch. 21: Duct Design";

            elements.lblOutF.textContent = "Friction Factor (f)";
            if (elements.rowOutSized) elements.rowOutSized.classList.remove("hidden");

            inputs = [
                {
                    id: "Q",
                    label_si: "Airflow (Q, L/s)",
                    label_ip: "Airflow (Q, cfm)",
                    placeholder_si: "e.g. 300",
                    placeholder_ip: "e.g. 636",
                    step: 25
                },
                {
                    id: "target_hf",
                    label_si: "Head Loss Target (ΔP/L, Pa/m)",
                    label_ip: "Head Loss Target (ΔP/L, in./100ft)",
                    placeholder_si: "Project target (e.g. 0.80)",
                    placeholder_ip: "Project target (e.g. 0.100)",
                    step: 0.05
                },
                {
                    id: "V",
                    label_si: "Bulk Velocity (V, m/s)",
                    label_ip: "Bulk Velocity (V, fpm)",
                    placeholder_si: "e.g. 3.0",
                    placeholder_ip: "e.g. 600",
                    step: 0.1
                },
                {
                    id: "De",
                    label_si: "Equivalent Diameter (De, mm)",
                    label_ip: "Equivalent Diameter (De, in.)",
                    placeholder_si: "e.g. 356.8 (Auto)",
                    placeholder_ip: "e.g. 14.0 (Auto)",
                    step: 5
                },
                {
                    id: "H",
                    label_si: "Duct Height (H, mm)",
                    label_ip: "Duct Height (H, in.)",
                    placeholder_si: "Optional (e.g. 250)",
                    placeholder_ip: "Optional (e.g. 10)",
                    step: 25
                },
                {
                    id: "W",
                    label_si: "Duct Width (W, mm)",
                    label_ip: "Duct Width (W, in.)",
                    placeholder_si: "Optional (e.g. 400)",
                    placeholder_ip: "Optional (e.g. 16)",
                    step: 25
                },
                {
                    id: "L",
                    label_si: "Duct Length (L, m)",
                    label_ip: "Duct Length (L, ft)",
                    default_si: 1,
                    default_ip: 10,
                    step: 1
                },
                {
                    id: "e",
                    label_si: "Absolute Roughness (e, mm)",
                    label_ip: "Absolute Roughness (e, ft)",
                    default_si: "0.21336",
                    default_ip: "0.00070",
                    step: 0.001
                },
                {
                    id: "rho",
                    label_si: "Air Density (ρ, kg/m³)",
                    label_ip: "Air Density (ρ, lbm/ft³)",
                    default_si: cond.density_si.toFixed(3),
                    default_ip: cond.density_ip.toFixed(4),
                    step: 0.001
                }
            ];
        } else {
            // Fitting Loss Analysis mode
            const fullTitle = formatFittingTitle(item);
            elements.displayFittingTitle.textContent = fullTitle;
            elements.displayFittingSubtitle.textContent = item.citation ? `(${item.citation})` : "";
            
            const crumbs = getItemHierarchyBreadcrumb(state.catalogTree, item.code);
            const crumbStr = crumbs && crumbs.length > 0 ? crumbs.join(" > ") : (item.category ? `Category: ${item.category}` : "ASHRAE Fundamentals, Ch. 21");
            elements.displayFittingCitation.textContent = crumbStr;

            elements.sheetTitleText.textContent = fullTitle;
            elements.sheetSubtitleText.textContent = item.citation ? `(${item.citation})` : "";

            if (elements.rowOutSized) elements.rowOutSized.classList.add("hidden");

            // Output Header Label for f vs Co
            if (item && ["CR11-1", "CD11-1", "CF11-1", "CD11-2", "SIZE-RECT", "SIZE-ROUND"].includes(item.code)) {
                elements.lblOutF.textContent = "Friction Factor (f)";
            } else {
                elements.lblOutF.textContent = "Loss Coeff (Co)";
            }

            inputs = [...((item && item.inputs) || [])];
        }

        // Toggle Sizing Banner (safely)
        if (elements.sizingBanner) {
            elements.sizingBanner.classList.toggle("hidden", !isSizer);
        }
        document.querySelectorAll(".sizing-extra-row").forEach(el => el.classList.toggle("hidden", !isSizer));

        elements.inputTableBody.innerHTML = "";

        inputs.forEach(inp => {
            const tr = document.createElement("tr");
            tr.id = `row-input-${inp.id}`;

            const tdLabel = document.createElement("td");
            tdLabel.className = "col-label";

            const tdInput = document.createElement("td");
            tdInput.className = "col-input";

            const inputEl = document.createElement("input");
            inputEl.type = "number";
            inputEl.id = `input-${inp.id}`;
            inputEl.dataset.fieldId = inp.id;
            inputEl.step = inp.step || "any";

            const minLimit = u === "SI" ? inp.min_si : inp.min_ip;
            const maxLimit = u === "SI" ? inp.max_si : inp.max_ip;
            if (minLimit !== undefined && minLimit !== null) {
                inputEl.dataset.min = minLimit;
                inputEl.min = minLimit;
            }
            if (maxLimit !== undefined && maxLimit !== null) {
                inputEl.dataset.max = maxLimit;
                inputEl.max = maxLimit;
            }
            if (minLimit !== undefined && maxLimit !== undefined) {
                inputEl.title = `Valid ASHRAE Range: ${minLimit} to ${maxLimit}`;
            }

            const isRoughness = (inp.id === "e" || inp.id === "ei" || inp.id === "roughness");

            if (isRoughness) {
                tr.classList.add("row-roughness");
                inputEl.type = "text";
                inputEl.inputMode = "decimal";

                // Label: Clean clickable link to open ASHRAE material picker dialog directly
                tdLabel.innerHTML = "";
                const link = document.createElement("a");
                link.className = "roughness-table-link";
                link.href = "javascript:void(0)";
                link.title = "Click to select duct material & roughness from official ASHRAE database";
                link.textContent = u === "SI" ? (inp.label_si || "Absolute Roughness (e, mm)") : (inp.label_ip || "Absolute Roughness (e, ft)");
                link.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    openRoughnessModal(inp.id);
                });
                tdLabel.appendChild(link);

                // Initial value: Starts BLANK ("") on load, reload, and reset.
                // Stays preserved once entered by the user (state.userRoughnessValue)
                // or converted across units (convertedValues).
                let initialVal = "";
                if (convertedValues && convertedValues[inp.id] !== undefined && convertedValues[inp.id] !== "") {
                    initialVal = convertedValues[inp.id];
                    if (isSizer) {
                        if (!state.userSizerValues) state.userSizerValues = {};
                        state.userSizerValues[inp.id] = initialVal;
                    } else {
                        state.userRoughnessValue = initialVal;
                    }
                } else if (convertedValues && (inp.id === "ei" ? convertedValues["e"] : convertedValues["ei"]) !== undefined && (inp.id === "ei" ? convertedValues["e"] : convertedValues["ei"]) !== "") {
                    initialVal = inp.id === "ei" ? convertedValues["e"] : convertedValues["ei"];
                    if (isSizer) {
                        if (!state.userSizerValues) state.userSizerValues = {};
                        state.userSizerValues[inp.id] = initialVal;
                    } else {
                        state.userRoughnessValue = initialVal;
                    }
                } else if (isSizer) {
                    if (state.userSizerValues && state.userSizerValues[inp.id] !== undefined && state.userSizerValues[inp.id] !== null && state.userSizerValues[inp.id] !== "") {
                        initialVal = state.userSizerValues[inp.id];
                    } else {
                        // McQuay default roughness in Auto Duct Sizer mode (exact parity with density)
                        const defRoughness = u === "SI" ? (inp.default_si !== undefined ? Number(inp.default_si).toFixed(3) : "0.213") : (inp.default_ip !== undefined ? Number(inp.default_ip).toFixed(4) : "0.0007");
                        initialVal = defRoughness;
                        if (!state.selectedRoughnessMaterial) {
                            state.selectedRoughnessMaterial = "Galvanized Steel, Medium Roughness (McQuay Default)";
                            state.activeRoughnessIndex = 6;
                        }
                    }
                } else if (state.userRoughnessValue !== null && state.userRoughnessValue !== undefined && state.userRoughnessValue !== "") {
                    initialVal = state.userRoughnessValue;
                } else {
                    const defRoughness = u === "SI" ? (inp.default_si !== undefined ? Number(inp.default_si).toFixed(3) : "0.090") : (inp.default_ip !== undefined ? Number(inp.default_ip).toFixed(4) : "0.0003");
                    initialVal = defRoughness;
                }

                inputEl.value = initialVal;
                const defRoughness = u === "SI" ? (inp.default_si !== undefined ? Number(inp.default_si).toFixed(3) : "0.090") : (inp.default_ip !== undefined ? Number(inp.default_ip).toFixed(4) : "0.0003");
                inputEl.placeholder = `e.g. ${defRoughness}`;

                // Double-clicking input field also opens the ASHRAE material dialog
                inputEl.title = "Double-click or click label to open ASHRAE Duct Material Roughness Picker";
                inputEl.addEventListener("dblclick", () => {
                    openRoughnessModal(inp.id);
                });

                inputEl.addEventListener("input", () => {
                    const raw = inputEl.value.trim();
                    if (isSizer) {
                        if (!state.userSizerValues) state.userSizerValues = {};
                        state.userSizerValues[inp.id] = inputEl.value;
                    }
                    if (raw !== "") {
                        state.userRoughnessValue = raw;
                        const typed = parseFloat(raw);
                        const isSi = state.unit === "SI";
                        const foundMat = ASHRAE_ROUGHNESS_MATERIALS.find(m => {
                            const val = parseFloat(isSi ? m.si : m.ip);
                            return Math.abs(val - typed) < 0.0005;
                        });
                        state.selectedRoughnessMaterial = foundMat ? foundMat.name : "Custom Roughness";
                    } else {
                        state.userRoughnessValue = null;
                        state.selectedRoughnessMaterial = null;
                    }
                });

                inputEl.addEventListener("change", () => {
                    const raw = inputEl.value.trim();
                    if (isSizer) {
                        if (!state.userSizerValues) state.userSizerValues = {};
                        state.userSizerValues[inp.id] = inputEl.value;
                    }
                    if (raw !== "") {
                        state.userRoughnessValue = raw;
                    } else {
                        state.userRoughnessValue = null;
                        state.selectedRoughnessMaterial = null;
                    }
                });

                tdInput.appendChild(inputEl);
            } else {
                tdLabel.textContent = u === "SI" ? (inp.label_si || inp.id) : (inp.label_ip || inp.id);
                if (convertedValues && convertedValues[inp.id] !== undefined && convertedValues[inp.id] !== "") {
                    inputEl.value = convertedValues[inp.id];
                    if (isSizer) {
                        if (!state.userSizerValues) state.userSizerValues = {};
                        state.userSizerValues[inp.id] = inputEl.value;
                    }
                } else if (isSizer) {
                    if (state.userSizerValues && state.userSizerValues[inp.id] !== undefined && state.userSizerValues[inp.id] !== null && state.userSizerValues[inp.id] !== "") {
                        inputEl.value = state.userSizerValues[inp.id];
                    } else if (inp.id === "Q" || inp.id === "target_hf" || inp.id === "H" || inp.id === "W" || inp.id === "D" || inp.id === "V" || inp.id === "De") {
                        inputEl.value = "";
                        inputEl.placeholder = u === "SI" ? (inp.placeholder_si || inp.default_si || "") : (inp.placeholder_ip || inp.default_ip || "");
                    } else {
                        inputEl.value = u === "SI" ? (inp.default_si !== undefined ? inp.default_si : 300) : (inp.default_ip !== undefined ? inp.default_ip : 12);
                    }
                } else {
                    if (inp.id === "L" && inp.label_si && inp.label_si.includes("(L, m)")) {
                        inputEl.value = u === "SI" ? (inp.default_si !== undefined ? Number(inp.default_si).toFixed(1) : "1.0") : (inp.default_ip !== undefined ? inp.default_ip : 100);
                    } else {
                        inputEl.value = u === "SI" ? (inp.default_si !== undefined ? inp.default_si : 300) : (inp.default_ip !== undefined ? inp.default_ip : 12);
                    }
                }
                tdInput.appendChild(inputEl);
            }

            // Real-time ASHRAE input range validation
            const checkRange = (el) => {
                const val = parseFloat(el.value);
                const min = el.dataset.min !== undefined ? parseFloat(el.dataset.min) : null;
                const max = el.dataset.max !== undefined ? parseFloat(el.dataset.max) : null;
                if (!isNaN(val) && el.value.trim() !== "") {
                    if ((min !== null && val < min) || (max !== null && val > max)) {
                        el.classList.add("input-out-of-range");
                        el.title = `Out of ASHRAE Range: ${min} to ${max}`;
                        return false;
                    }
                }
                el.classList.remove("input-out-of-range");
                if (min !== null && max !== null) {
                    el.title = `Valid ASHRAE Range: ${min} to ${max}`;
                }
                return true;
            };

            inputEl.addEventListener("input", () => {
                checkRange(inputEl);
            });
            inputEl.addEventListener("change", () => {
                checkRange(inputEl);
            });
            checkRange(inputEl);

            // Listeners for calculate and bi-directional multi-way continuity solving
            inputEl.addEventListener("keypress", (e) => {
                if (e.key === "Enter") calculate();
            });
            inputEl.addEventListener("input", () => {
                if (isSizer) {
                    if (!state.userSizerValues) state.userSizerValues = {};
                    state.userSizerValues[inp.id] = inputEl.value;
                }
                solveTwoValues(inp.id);
                debounceCalculate();
            });
            inputEl.addEventListener("change", () => {
                if (isSizer) {
                    if (!state.userSizerValues) state.userSizerValues = {};
                    state.userSizerValues[inp.id] = inputEl.value;
                }
            });

            tr.appendChild(tdLabel);
            tr.appendChild(tdInput);
            elements.inputTableBody.appendChild(tr);
        });

        updateFsHud();
    }

        function formatAppDate(dateInput) {
        if (!dateInput) return "-";
        const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    // --- Mode & Unit Switches ---
    function setMode(newMode, preferredShape) {
        state.mode = newMode;
        elements.btnModeDirect.classList.toggle("active", newMode === "direct");
        elements.btnModeSizer.classList.toggle("active", newMode === "sizer");

        if (newMode === "sizer") {
            restoreStandardOutputTable();
            state.activeCode = "SIZE-AUTO";
            state.activeItem = getFallbackItem("SIZE-AUTO");

            // Strictly separate: Hide Fitting Catalog & CAD drafting workspace in Sizer mode
            if (elements.catalogSidebar) elements.catalogSidebar.style.display = "none";
            if (elements.catalogResizer) elements.catalogResizer.style.display = "none";
            if (elements.drawingWorkspace) elements.drawingWorkspace.style.display = "none";
            document.querySelectorAll(".window-divider").forEach(el => el.style.display = "none");

            // Keep Step-by-Step Engineering Calculation Breakdown collapsed by default
            if (elements.formulasWrapper) {
                elements.formulasWrapper.classList.remove("hidden");
                elements.formulasWrapper.style.display = "";
            }
        } else {
            // Restore Fitting Catalog & CAD drafting workspace in Fitting Loss Analysis mode
            if (elements.catalogSidebar) elements.catalogSidebar.style.display = "";
            if (elements.catalogResizer) elements.catalogResizer.style.display = "";
            if (elements.drawingWorkspace) elements.drawingWorkspace.style.display = "";
            document.querySelectorAll(".window-divider").forEach(el => el.style.display = "");

            updateProjectRibbonBadge();

            // Seamlessly restore the exact active fitting with official catalog inputs and outputs
            const targetCode = (state.lastDirectCode && !state.lastDirectCode.startsWith("SIZE-")) 
                ? state.lastDirectCode 
                : "CR11-1";
            selectFitting(targetCode);
            return;
        }

        updateProjectRibbonBadge();
        updateHeaderAndInputs();
        if (newMode === "sizer") {
            const hasSizerInputs = state.userSizerValues && Object.entries(state.userSizerValues).some(([k, v]) => {
                return (k === "Q" || k === "target_hf" || k === "V" || k === "H" || k === "W" || k === "D") && v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v));
            });
            if (hasSizerInputs) {
                calculate();
            } else {
                clearSizerOutputs();
            }
        }
    }

    function switchSizerShape(shape) {
        state.sizerShape = shape;
        setMode("sizer", shape);
    }

    function formatPrecise(val, maxDecimals = 2) {
        if (val === null || val === undefined || isNaN(val)) return "";
        const rInt = Math.round(val);
        if (Math.abs(val - rInt) < 0.01) {
            return rInt.toString();
        }
        const factor = Math.pow(10, maxDecimals);
        const rounded = Math.round(val * factor) / factor;
        return rounded.toString();
    }

    function convertInputValue(fieldId, val, fromUnit, toUnit) {
        if (val === null || val === undefined || isNaN(val)) return "";
        if (fromUnit === toUnit) return val.toString();

        const isSiToIp = (fromUnit === "SI" && toUnit === "IP");

        const dimFields = [
            "H", "H1", "Hb", "Ho", "Hs", "h",
            "W", "W1", "Wb", "Wb1", "Wb2", "Wc", "Wo", "Ws", "w",
            "D", "D1", "Db", "Db1", "Db2", "Dc", "De", "Do", "Dor", "Ds", "d", "dc",
            "a", "a1", "a2", "b", "B", "A",
            "r", "t", "y", "hg"
        ];

        if (dimFields.includes(fieldId)) {
            if (isSiToIp) {
                const inches = val / 25.4;
                return formatPrecise(inches, 2);
            } else {
                const mm = val * 25.4;
                return formatPrecise(mm, 1);
            }
        }

        const lenFields = ["L", "L1", "L2", "LFE", "L_FE"];
        if (lenFields.includes(fieldId)) {
            if (isSiToIp) {
                const ft = val / 0.3048;
                return formatPrecise(ft, 2);
            } else {
                const m = val * 0.3048;
                return formatPrecise(m, 2);
            }
        }

        const flowFields = ["Q", "Qb", "Qb1", "Qb2", "Qc", "Qs", "Q1", "Q2"];
        if (flowFields.includes(fieldId)) {
            if (isSiToIp) {
                const cfm = val / 0.471947443;
                return formatPrecise(cfm, 1);
            } else {
                const lps = val * 0.471947443;
                return formatPrecise(lps, 1);
            }
        }

        const velFields = ["V", "Vo", "V1", "V2", "Vc", "Vb", "Vs"];
        if (velFields.includes(fieldId)) {
            if (isSiToIp) {
                const fpm = val * (60.0 / 0.3048);
                return formatPrecise(fpm, 1);
            } else {
                const ms = val * (0.3048 / 60.0);
                return formatPrecise(ms, 1);
            }
        }

        if (fieldId === "e" || fieldId === "ei") {
            if (isSiToIp) {
                // McQuay default roughness exact mapping
                if (Math.abs(val - 0.213) < 0.001 || Math.abs(val - 0.21336) < 0.0001) return "0.0007";
                const ft = val / 304.8;
                return formatPrecise(ft, 5);
            } else {
                // McQuay default roughness exact mapping
                if (Math.abs(val - 0.0007) < 0.00005) return "0.213";
                const mm = val * 304.8;
                return formatPrecise(mm, 4);
            }
        }

        if (fieldId === "rho") {
            if (isSiToIp) {
                // Official ASHRAE standard air density exact mapping
                if (Math.abs(val - 1.204) < 0.005) return "0.075";
                const lbm = val / 16.018463;
                return formatPrecise(lbm, 4);
            } else {
                // Official ASHRAE standard air density exact mapping
                if (Math.abs(val - 0.075) < 0.002) return "1.204";
                const kg = val * 16.018463;
                return formatPrecise(kg, 3);
            }
        }

        if (fieldId === "target_hf") {
            if (isSiToIp) {
                const in100ft = val / (249.0889 / 30.48);
                return formatPrecise(in100ft, 3);
            } else {
                const pam = val * (249.0889 / 30.48);
                return formatPrecise(pam, 2);
            }
        }

        return val.toString();
    }

    function setUnit(newUnit) {
        if (state.unit === newUnit) return;
        const oldUnit = state.unit;
        state.unit = newUnit;
        elements.btnUnitSI.classList.toggle("active", newUnit === "SI");
        elements.btnUnitIP.classList.toggle("active", newUnit === "IP");

        // Collect all current input values before rebuilding
        const convertedValues = {};
        if (elements.inputTableBody) {
            elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                const fieldId = inp.dataset.fieldId;
                const rawVal = inp.value ? inp.value.trim() : "";
                if (rawVal !== "") {
                    const num = parseFloat(rawVal);
                    if (!isNaN(num)) {
                        convertedValues[fieldId] = convertInputValue(fieldId, num, oldUnit, newUnit);
                    }
                }
            });
        }

        // Convert stored in-session Auto Duct Sizer inputs
        if (state.userSizerValues) {
            for (const [fId, valStr] of Object.entries(state.userSizerValues)) {
                if (valStr !== "" && valStr !== null && valStr !== undefined) {
                    const num = parseFloat(valStr);
                    if (!isNaN(num)) {
                        state.userSizerValues[fId] = convertInputValue(fId, num, oldUnit, newUnit);
                    }
                }
            }
        }

        // Convert Sizing controls if present
        if (elements.sizeTargetVal && elements.sizeTargetVal.value) {
            const rawTg = parseFloat(elements.sizeTargetVal.value);
            if (!isNaN(rawTg)) {
                if (state.sizeTargetType === "velocity") {
                    elements.sizeTargetVal.value = convertInputValue("V", rawTg, oldUnit, newUnit);
                } else {
                    elements.sizeTargetVal.value = convertInputValue("target_hf", rawTg, oldUnit, newUnit);
                }
            }
            if (elements.lblTargetVal) {
                if (state.sizeTargetType === "velocity") {
                    elements.lblTargetVal.textContent = newUnit === "SI" ? "Target Vel (m/s):" : "Target Vel (fpm):";
                } else {
                    elements.lblTargetVal.textContent = newUnit === "SI" ? "Target Loss (Pa/m):" : "Target Loss (in/100ft):";
                }
            }
        }

        if (elements.sizeFixedDim && elements.sizeFixedDim.value) {
            const rawFixed = parseFloat(elements.sizeFixedDim.value);
            if (!isNaN(rawFixed) && state.sizeFixedType !== "AR") {
                elements.sizeFixedDim.value = convertInputValue("H", rawFixed, oldUnit, newUnit);
            }
            if (elements.lblFixedDim) {
                if (state.sizeFixedType === "W") {
                    elements.lblFixedDim.textContent = newUnit === "SI" ? "Width (mm):" : "Width (in):";
                } else if (state.sizeFixedType === "H") {
                    elements.lblFixedDim.textContent = newUnit === "SI" ? "Height (mm):" : "Height (in):";
                }
            }
        }

        // Refresh air condition UI with new units (kg/m³ vs lbm/ft³, °C vs °F)
        updateAirConditionUI();

        // Refresh inputs with converted values
        updateHeaderAndInputs(convertedValues);
        calculate();
    }

    function resetToScreenshotDefault() {
        state.userSizerValues = {};
        state.activeCode = "CR11-1";
        state.mode = "direct";
        state.unit = "SI";
        state.selectedAirConditionId = "comfort_return";
        updateAirConditionUI();
        elements.btnUnitSI.classList.add("active");
        elements.btnUnitIP.classList.remove("active");
        elements.btnModeDirect.classList.add("active");
        elements.btnModeSizer.classList.remove("active");

        // Highlight in tree
        document.querySelectorAll(".tree-row.selected").forEach(el => el.classList.remove("selected"));
        const leaf = elements.treeViewContainer.querySelector('[data-code="CR11-1"]');
        if (leaf) {
            const row = leaf.querySelector(".tree-row");
            if (row) row.classList.add("selected");
        }

        state.activeItem = getFallbackItem("CR11-1");
        updateHeaderAndInputs();

        // Exact Screenshot values
        state.selectedRoughnessMaterial = "Galvanized Steel, Round, Longitudinal Seams";
        state.activeRoughnessIndex = 3;
        setInputVal("H", 300);
        setInputVal("W", 300);
        setInputVal("e", "0.09000");
        setInputVal("L", 3);
        setInputVal("Q", 2000);

        calculate();
    }

    function setInputVal(id, val) {
        const inp = document.getElementById(`input-${id}`);
        if (inp && document.activeElement !== inp) inp.value = val;
    }

    function getInputVal(id, def) {
        const inp = document.getElementById(`input-${id}`);
        return inp ? parseFloat(inp.value) : def;
    }

    // --- Debounced Calculate ---
    let debounceTimer = null;
    function debounceCalculate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(calculate, 200);
    }

    // --- Core Calculate Function ---
    async function downloadCurrentCalculationPdf(e) {
        if (e) e.stopPropagation();

        const isSizer = state.mode === "sizer" || (state.activeCode && state.activeCode.startsWith("SIZE-"));
        const code = isSizer ? "SIZE-AUTO" : (state.activeCode || "CR11-1");
        const fittingName = isSizer ? "Auto Duct Sizer" : (state.activeItem?.name || elements.sheetTitleText?.textContent || code);

        // Gather current inputs from table
        const inputs = {};
        if (elements.inputTableBody) {
            elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                const val = parseFloat(inp.value);
                if (!isNaN(val)) {
                    inputs[inp.dataset.fieldId] = val;
                }
            });
            if ("ei" in inputs && !("e" in inputs)) inputs.e = inputs.ei;
            if ("e" in inputs && !("ei" in inputs)) inputs.ei = inputs.e;
        }

        showPrjToast("Generating DuctFit Pro calculation PDF report...");

        try {
            const payload = {
                code: code,
                name: fittingName,
                unit_system: state.unit || "SI",
                project_id: state.activeProjectId || null,
                inputs: inputs,
                steps: state.activeData?.steps || []
            };

            const response = await fetch("/api/calculations/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("Server returned " + response.status);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `${code}_DuctFit_Pro_Calculation.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            showPrjToast("📄 Calculation PDF downloaded successfully!");
        } catch (err) {
            console.error("Calculation PDF download failed:", err);
            showPrjToast("Error generating calculation PDF.");
        }
    }

    async function calculate() {
        // Collect current inputs from table
        const inputs = {};
        elements.inputTableBody.querySelectorAll("input").forEach(inp => {
            const raw = inp.value ? inp.value.trim() : "";
            if (raw !== "") {
                const val = parseFloat(raw);
                if (!isNaN(val) && isFinite(val)) {
                    inputs[inp.dataset.fieldId] = val;
                }
            }
        });

        // Synchronize roughness fields e and ei if provided
        if ("ei" in inputs && !("e" in inputs)) {
            inputs.e = inputs.ei;
        }
        if ("e" in inputs && !("ei" in inputs)) {
            inputs.ei = inputs.e;
        }

        const cond = AIR_CONDITIONS[state.selectedAirConditionId] || AIR_CONDITIONS["comfort_return"];

        const isSizer = state.mode === "sizer" || (state.activeCode && state.activeCode.startsWith("SIZE-"));

        if (isSizer) {
            if (!state.userSizerValues) state.userSizerValues = {};
            elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                const fid = inp.dataset.fieldId;
                if (inp.value && inp.value.trim() !== "") {
                    state.userSizerValues[fid] = inp.value.trim();
                }
            });
            const hasQ = ("Q" in inputs) && !isNaN(inputs.Q) && inputs.Q > 0;
            const hasConstraint = ("target_hf" in inputs && !isNaN(inputs.target_hf) && inputs.target_hf > 0) ||
                                  ("V" in inputs && !isNaN(inputs.V) && inputs.V > 0) ||
                                  ("De" in inputs && !isNaN(inputs.De) && inputs.De > 0) ||
                                  ("H" in inputs && !isNaN(inputs.H) && inputs.H > 0) ||
                                  ("W" in inputs && !isNaN(inputs.W) && inputs.W > 0) ||
                                  ("D" in inputs && !isNaN(inputs.D) && inputs.D > 0);

            if (!hasQ || !hasConstraint) {
                clearSizerOutputs();
                return;
            }
        }

        // In Fitting Loss Analysis, air density is strictly constant and non-editable (ASHRAE Database standard: 1.204 SI / 0.075 IP)
        if (isSizer) {
            if (!("rho" in inputs)) inputs.rho = state.unit === "SI" ? cond.density_si : cond.density_ip;
        } else {
            inputs.rho = state.unit === "SI" ? 1.204 : 0.075;
            if (!("Q" in inputs) && !("Qc" in inputs) && !("Q1" in inputs) && !("Qo" in inputs)) {
                inputs.Q = state.unit === "SI" ? 2000.0 : 4238.0;
            }
        }

        if (state.selectedRoughnessMaterial) {
            inputs.material_name = state.selectedRoughnessMaterial;
        }
        const targetType = (state.lastConstraint === "V") ? "velocity" : "friction";
        const targetVal = targetType === "velocity"
            ? ((inputs.V !== undefined && !isNaN(inputs.V)) ? inputs.V : (state.unit === "SI" ? 2.5 : 492))
            : ((inputs.target_hf !== undefined && !isNaN(inputs.target_hf))
                ? inputs.target_hf
                : ((elements.sizeTargetVal && parseFloat(elements.sizeTargetVal.value)) || (state.unit === "SI" ? 0.80 : 0.100)));

        const hasUserH = ("H" in inputs) && !isNaN(inputs.H) && inputs.H > 0;
        const hasUserW = ("W" in inputs) && !isNaN(inputs.W) && inputs.W > 0;
        let fixedType = "NONE";
        let fixedDim = 0.0;
        let lastChanged = state.lastChanged || "NONE";

        if (hasUserH && !hasUserW) {
            fixedType = "H";
            fixedDim = inputs.H;
            lastChanged = "H";
        } else if (hasUserW && !hasUserH) {
            fixedType = "W";
            fixedDim = inputs.W;
            lastChanged = "W";
        } else if (hasUserH && hasUserW) {
            fixedType = lastChanged === "W" ? "W" : "H";
            fixedDim = fixedType === "W" ? inputs.W : inputs.H;
        } else {
            fixedType = "NONE";
            fixedDim = 0.0;
            lastChanged = "NONE";
        }

        const payload = {
            code: state.activeCode,
            inputs: inputs,
            unit_system: state.unit,
            mode: state.mode,
            shape: state.activeItem ? state.activeItem.shape : "rect",
            target_type: targetType,
            target_val: targetVal,
            last_changed: lastChanged,
            fixed_type: fixedType,
            fixed_dim: fixedDim,
            air_condition_id: state.selectedAirConditionId || "comfort_return"
        };

        try {
            const resp = await fetch("/api/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const res = await resp.json();
            if (res.status === "success") {
                if (payload.mode !== state.mode || payload.code !== state.activeCode) {
                    return;
                }
                state.activeData = res.data;
                renderOutputs(res.data);
                renderFormulas(res.data.steps || []);
                renderCadDrawing();
                updateFsHud();
            } else {
                console.error("Calculation returned error:", res.message);
            }
        } catch (err) {
            console.error("Calculate request failed:", err);
        }
    }

    // --- Render Output Table ---
    function renderOutputs(d) {
        const u = state.unit;

        // ASHRAE Limit Alert Banner
        const alertEl = document.getElementById("ashrae-range-alert");
        if (alertEl) {
            if (d && d.out_of_range_warnings && d.out_of_range_warnings.length > 0) {
                alertEl.innerHTML = `<strong>⚠️ ASHRAE Limit Notice:</strong> ${escapeHtml(d.out_of_range_warnings.join(" "))}`;
                alertEl.classList.add("visible");
            } else {
                alertEl.innerHTML = "";
                alertEl.classList.remove("visible");
            }
        }

        if (state.mode === "sizer" || state.activeCode.startsWith("SIZE-")) {
            // Sizing Mode Outputs (ASHRAE Equal Friction & Velocity Methods)
            const r = d.rectangular || (d.round ? d.round.calc : d);
            
            if (elements.rowOutSized) elements.rowOutSized.classList.remove("hidden");

            if (elements.lblOutV) elements.lblOutV.textContent = u === "SI" ? "Velocity (V, m/s)" : "Velocity (V, fpm)";
            if (elements.lblOutFr) elements.lblOutFr.textContent = u === "SI" ? "Actual Head Loss (ΔP/L, Pa/m)" : "Actual Head Loss (ΔP/L, in./100ft)";
            elements.lblOutPv.textContent = u === "SI" ? "Vel Pres at V (Pv, Pa)" : "Vel Pres at V (Pv, in. wg)";
            elements.lblOutF.textContent = "Friction Factor (f)";
            elements.lblOutDp.textContent = u === "SI" ? "Pressure Loss (Pa)" : "Pressure Loss (in. wg)";

            const actualLoss = u === "SI"
                ? (r.actual_head_loss_pa_m !== undefined ? r.actual_head_loss_pa_m : r.friction_rate_pa_m)
                : (r.actual_head_loss_in_100ft !== undefined ? r.actual_head_loss_in_100ft : r.friction_rate_in_100ft);

            if (elements.outFr) {
                const lossFmt = typeof actualLoss === "number" ? (u === "SI" ? actualLoss.toFixed(2) : actualLoss.toFixed(3)) : (actualLoss || "-");
                elements.outFr.textContent = lossFmt;
            }

            if (elements.outV) {
                const vel = (d.rectangular && r.velocity_ms !== undefined) ? (u === "SI" ? r.velocity_ms.toFixed(1) : Math.round(r.velocity_fpm).toLocaleString())
                    : (d.round ? (u === "SI" ? (d.round.calc ? d.round.calc.velocity_ms : r.velocity_ms).toFixed(1) : Math.round(d.round.calc ? d.round.calc.velocity_fpm : r.velocity_fpm).toLocaleString())
                    : (r.velocity_ms !== undefined ? (u === "SI" ? r.velocity_ms.toFixed(1) : Math.round(r.velocity_fpm).toLocaleString()) : "-"));
                elements.outV.textContent = vel;
            }

            if (u === "SI") {
                elements.outPv.textContent = (r.pv_pa < 10) ? r.pv_pa.toFixed(2) : Math.round(r.pv_pa);
                elements.outF.textContent = r.f.toFixed(4);
                elements.outDp.textContent = r.pressure_loss_pa.toFixed(1);

                if (d.rectangular) {
                    if (r.has_user_dimension === false) {
                        if (elements.outSized) elements.outSized.textContent = `Ø ${r.De_mm.toFixed(1)} mm Equivalent`;
                        if (elements.outDe) elements.outDe.textContent = `${r.De_mm.toFixed(1)} mm`;
                        if (elements.outAR) elements.outAR.textContent = "1.00 : 1";
                        setInputVal("De", r.De_mm.toFixed(1));
                    } else {
                        if (elements.outSized) elements.outSized.textContent = `${r.H_nom_mm} × ${r.W_nom_mm} mm`;
                        if (elements.outDe) elements.outDe.textContent = `${r.De_mm.toFixed(1)} mm`;
                        if (elements.outAR) elements.outAR.textContent = `${r.aspect_ratio.toFixed(2)} : 1`;
                        setInputVal("De", r.De_mm.toFixed(1));
                        if (state.lastChanged === "W") {
                            setInputVal("H", r.H_nom_mm);
                            updateAutoBadges("H");
                        } else {
                            setInputVal("W", r.W_nom_mm);
                            updateAutoBadges("W");
                        }
                    }
                    if (state.lastConstraint !== "V") {
                        setInputVal("V", r.velocity_ms.toFixed(1));
                    }
                } else if (d.round) {
                    if (elements.outSized) elements.outSized.textContent = `Ø ${d.round.D_nom_mm} mm`;
                    if (elements.outDe) elements.outDe.textContent = `${d.round.D_nom_mm} mm`;
                    if (elements.outAR) elements.outAR.textContent = `1.00 : 1`;
                    setInputVal("D", d.round.D_nom_mm);
                    if (state.lastConstraint !== "V") {
                        setInputVal("V", (d.round.calc ? d.round.calc.velocity_ms : r.velocity_ms).toFixed(1));
                    }
                }
            } else {
                elements.outPv.textContent = (r.pv_in_wg < 0.1) ? r.pv_in_wg.toFixed(4) : r.pv_in_wg.toFixed(3);
                elements.outF.textContent = r.f.toFixed(4);
                elements.outDp.textContent = r.pressure_loss_in_wg.toFixed(3);

                if (d.rectangular) {
                    if (r.has_user_dimension === false) {
                        if (elements.outSized) elements.outSized.textContent = `Ø ${r.De_in.toFixed(1)}" Equivalent`;
                        if (elements.outDe) elements.outDe.textContent = `${r.De_in.toFixed(1)}"`;
                        if (elements.outAR) elements.outAR.textContent = "1.00 : 1";
                        setInputVal("De", r.De_in.toFixed(1));
                    } else {
                        const hIn = Math.round(r.H_in);
                        const wIn = Math.round(r.W_in);
                        if (elements.outSized) elements.outSized.textContent = `${hIn}" × ${wIn}"`;
                        if (elements.outDe) elements.outDe.textContent = `${r.De_in.toFixed(1)}"`;
                        if (elements.outAR) elements.outAR.textContent = `${r.aspect_ratio.toFixed(2)} : 1`;
                        setInputVal("De", r.De_in.toFixed(1));
                        if (state.lastChanged === "W") {
                            setInputVal("H", hIn);
                            updateAutoBadges("H");
                        } else {
                            setInputVal("W", wIn);
                            updateAutoBadges("W");
                        }
                    }
                    if (state.lastConstraint !== "V") {
                        setInputVal("V", Math.round(r.velocity_fpm).toString());
                    }
                } else if (d.round) {
                    if (elements.outSized) elements.outSized.textContent = `Ø ${d.round.D_nom_in}"`;
                    if (elements.outDe) elements.outDe.textContent = `${d.round.D_nom_in}"`;
                    if (elements.outAR) elements.outAR.textContent = `1.00 : 1`;
                    setInputVal("D", d.round.D_nom_in);
                    if (state.lastConstraint !== "V") {
                        setInputVal("V", Math.round(d.round.calc ? d.round.calc.velocity_fpm : r.velocity_fpm).toString());
                    }
                }
            }
            updateSizerTargetCitation();
        } else {
            // Fitting Loss Analysis (direct mode)
            const item = state.activeItem || getFallbackItem(state.activeCode);
            if (item && item.output_details && item.output_details.length > 0) {
                // Official ASHRAE Database Output Table Rendering
                elements.outputTableBody.innerHTML = "";

                item.output_details.forEach(od => {
                    const prompt = od.prompt || od.variable;
                    const match = prompt.match(/^\{([^}]+)\}(.*)$/);
                    if (match) {
                        const sectionTitle = match[1];
                        const secTr = document.createElement("tr");
                        secTr.className = "row-section-header";
                        secTr.style.background = "#e2e8f0";
                        secTr.style.borderTop = "1px solid #cbd5e1";
                        secTr.style.borderBottom = "1px solid #cbd5e1";
                        secTr.innerHTML = `<td colspan="2" style="text-align:center; color:#0f172a; font-weight:700; padding:6px 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.75px;">${escapeHtml(sectionTitle)}</td>`;
                        elements.outputTableBody.appendChild(secTr);
                    }

                    const cleanPrompt = match ? match[2].trim() : prompt.trim();
                    const unitStr = u === "SI" ? (od.si_unit || "") : (od.ip_unit || "");
                    const labelText = unitStr ? `${cleanPrompt} ${unitStr}` : cleanPrompt;

                    // Retrieve calculated value from d.raw_env or d
                    let val = undefined;
                    if (d.raw_env && d.raw_env[od.variable] !== undefined) {
                        val = d.raw_env[od.variable];
                    } else if (d[od.variable] !== undefined) {
                        val = d[od.variable];
                    } else if (od.variable === "Co" && d.loss_coeff_Co !== undefined) {
                        val = d.loss_coeff_Co;
                    } else if (od.variable === "Po" && (d.pressure_loss_pa !== undefined || d.pressure_loss_in_wg !== undefined)) {
                        val = u === "SI" ? d.pressure_loss_pa : d.pressure_loss_in_wg;
                    } else if ((od.variable === "Vo" || od.variable === "V") && (d.velocity_ms !== undefined || d.velocity_fpm !== undefined)) {
                        val = u === "SI" ? d.velocity_ms : d.velocity_fpm;
                    } else if ((od.variable === "Pvo" || od.variable === "Pv") && (d.pv_pa !== undefined || d.pv_in_wg !== undefined)) {
                        val = u === "SI" ? d.pv_pa : d.pv_in_wg;
                    }

                    let formattedVal = "-";
                    if (val !== undefined && val !== null && !isNaN(val)) {
                        const num = parseFloat(val);
                        const dec = u === "SI" ? od.si_decimals : od.ip_decimals;
                        if (dec !== undefined && dec !== null) {
                            formattedVal = dec === 0 ? Math.round(num).toString() : num.toFixed(dec);
                        } else {
                            if (Math.abs(num) >= 100) formattedVal = Math.round(num).toString();
                            else if (Math.abs(num) >= 10) formattedVal = num.toFixed(1);
                            else formattedVal = num.toFixed(2);
                        }
                    }

                    const isLoss = od.variable === "Po" || od.variable === "Pob" || od.variable === "Pos" || cleanPrompt.toLowerCase().includes("pressure loss");
                    const tr = document.createElement("tr");
                    if (isLoss) {
                        tr.className = "row-highlight-loss";
                    }

                    const tdLabel = document.createElement("td");
                    tdLabel.className = "col-label";
                    tdLabel.textContent = labelText;

                    const tdVal = document.createElement("td");
                    tdVal.className = "col-output";
                    if (isLoss) {
                        tdVal.style.fontWeight = "bold";
                        tdVal.style.color = "#b45309";
                    }
                    tdVal.textContent = formattedVal;

                    tr.appendChild(tdLabel);
                    tr.appendChild(tdVal);
                    elements.outputTableBody.appendChild(tr);
                });
            } else {
                if (!document.getElementById("out-dp") || !elements.outDp) {
                    restoreStandardOutputTable();
                }
                if (elements.rowOutSized) elements.rowOutSized.classList.add("hidden");

                if (elements.lblOutV) elements.lblOutV.textContent = u === "SI" ? "Velocity (V, m/s)" : "Velocity (V, fpm)";
                if (elements.lblOutFr) elements.lblOutFr.textContent = u === "SI" ? "Friction Rate (Pa/m)" : "Friction Rate (in./100ft)";
                elements.lblOutPv.textContent = u === "SI" ? "Vel Pres at V (Pv, Pa)" : "Vel Pres at V (Pv, in. wg)";
                elements.lblOutDp.textContent = u === "SI" ? "Pressure Loss (Pa)" : "Pressure Loss (in. wg)";

                if (u === "SI") {
                    if (elements.outV) elements.outV.textContent = (d.velocity_ms !== undefined) ? d.velocity_ms.toFixed(1) : (d.Vo_ms !== undefined ? d.Vo_ms.toFixed(1) : "-");
                    if (elements.outFr) elements.outFr.textContent = (d.friction_rate_pa_m !== undefined) ? d.friction_rate_pa_m.toFixed(2) : "-";
                    elements.outPv.textContent = (d.pv_pa !== undefined) ? Math.round(d.pv_pa) : "-";
                    elements.outF.textContent = (d.f !== undefined) ? d.f.toFixed(4) : (d.loss_coeff_Co !== undefined ? d.loss_coeff_Co.toFixed(4) : "-");
                    elements.outDp.textContent = (d.pressure_loss_pa !== undefined) ? d.pressure_loss_pa.toFixed(1) : "-";
                } else {
                    if (elements.outV) elements.outV.textContent = (d.velocity_fpm !== undefined) ? Math.round(d.velocity_fpm).toLocaleString() : (d.Vo_fpm !== undefined ? Math.round(d.Vo_fpm).toLocaleString() : "-");
                    if (elements.outFr) elements.outFr.textContent = (d.friction_rate_in_100ft !== undefined) ? d.friction_rate_in_100ft.toFixed(3) : "-";
                    elements.outPv.textContent = (d.pv_in_wg !== undefined) ? d.pv_in_wg.toFixed(3) : "-";
                    elements.outF.textContent = (d.f !== undefined) ? d.f.toFixed(4) : (d.loss_coeff_Co !== undefined ? d.loss_coeff_Co.toFixed(4) : "-");
                    elements.outDp.textContent = (d.pressure_loss_in_wg !== undefined) ? d.pressure_loss_in_wg.toFixed(3) : "-";
                }

                if (elements.outDe) {
                    if (d.De_mm !== undefined) {
                        elements.outDe.textContent = u === "SI" ? `${Math.round(d.De_mm)} mm` : `${(d.De_mm / 25.4).toFixed(1)}"`;
                        if (elements.rowOutDe) elements.rowOutDe.classList.remove("hidden");
                    } else {
                        if (elements.rowOutDe) elements.rowOutDe.classList.add("hidden");
                    }
                }
                if (elements.outAR) {
                    if (d.aspect_ratio !== undefined) {
                        elements.outAR.textContent = `${d.aspect_ratio.toFixed(2)} : 1`;
                        if (elements.rowOutAR) elements.rowOutAR.classList.remove("hidden");
                    } else {
                        if (elements.rowOutAR) elements.rowOutAR.classList.add("hidden");
                    }
                }
            }
        }

        // McQuay-Inspired Output Aerodynamics: Flow Area & Reynolds Number
        const rActive = d.rectangular || (d.round ? d.round.calc : d);
        const areaVal = d.area_m2 !== undefined ? d.area_m2 : (rActive ? rActive.area_m2 : undefined);
        if (elements.outArea && areaVal !== undefined) {
            if (u === "SI") {
                if (elements.lblOutArea) elements.lblOutArea.textContent = "Flow Area (A)";
                elements.outArea.textContent = `${areaVal.toFixed(4)} m²`;
            } else {
                if (elements.lblOutArea) elements.lblOutArea.textContent = "Flow Area (A)";
                const areaSqFt = areaVal * 10.7639;
                elements.outArea.textContent = `${areaSqFt.toFixed(2)} sq ft (${Math.round(areaSqFt * 144)} in²)`;
            }
        }
        const reVal = d.reynolds !== undefined ? d.reynolds : (rActive ? rActive.reynolds : undefined);
        if (elements.outRe) {
            elements.outRe.textContent = (reVal !== undefined && reVal > 0) ? Math.round(reVal).toLocaleString() : "-";
        }
    }

    // --- Render Step-by-Step Mathematical Formulas Panel (College Textbook Edition) ---
    function renderFormulas(steps) {
        elements.formulasContainer.innerHTML = "";
        if (!steps || steps.length === 0) {
            elements.formulasContainer.innerHTML = `<div class="tb-empty-note">No calculation breakdown available for this item.</div>`;
            return;
        }

        steps.forEach(st => {
            const card = document.createElement("div");
            card.className = "formula-card tb-card";

            // 1. Header with Academic Badge, Title, and Citation
            const stepLabel = escapeHtml(st.step_label || ('STEP ' + st.step_num));
            const stepTitle = escapeHtml(st.title || '');
            const citationHtml = st.citation ? `<span class="tb-citation">${escapeHtml(st.citation)}</span>` : '';

            // 2. Governing Formulation
            let governingHtml = '';
            if (st.governing_latex) {
                governingHtml = `
                    <div class="tb-block tb-governing-block">
                        <div class="tb-block-label"><span class="tb-label-icon">📜</span> Governing Formulation</div>
                        <div class="tb-math-display">$$${st.governing_latex}$$</div>
                    </div>
                `;
            } else if (st.formula) {
                governingHtml = `
                    <div class="tb-block tb-governing-block">
                        <div class="tb-block-label"><span class="tb-label-icon">📜</span> Governing Formulation</div>
                        <div class="tb-math-display">$$${escapeHtml(st.formula)}$$</div>
                    </div>
                `;
            }

            // 3. Parameters / Given Values
            let paramsHtml = '';
            if (st.parameters && st.parameters.length > 0) {
                const IGNORED = new Set([
                    'materialname', 'airconditionid', 'aircondition', 'unitsystem',
                    'shape', 'code', 'targettype', 'targetval', 'fixedtype', 'fixeddim',
                    'lfe', 'ei', 'mu', 'dc', 'evallog', 'steps', 'drawing', 'fittings',
                    'rawenv', 'material', 'air'
                ]);

                const seenKeys = new Set();
                const filteredParams = st.parameters.filter(p => {
                    if (!p) return false;
                    const sym = String(p.symbol || '').trim();
                    const name = String(p.name || '').trim();
                    const symNorm = sym.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const nameNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (IGNORED.has(symNorm) || IGNORED.has(nameNorm)) return false;
                    // Deduplicate aliases
                    if (symNorm === 'do' && (seenKeys.has('d') || st.parameters.some(x => (x.symbol||'').toLowerCase() === 'd'))) return false;
                    if (symNorm === 'lfe' && (seenKeys.has('lfe') || seenKeys.has('lfe') || st.parameters.some(x => (x.symbol||'').toLowerCase().includes('l_fe')))) return false;
                    if (symNorm === 'rho' && seenKeys.has('rho')) return false;
                    if (seenKeys.has(symNorm)) return false;
                    seenKeys.add(symNorm);
                    return true;
                });

                if (filteredParams.length > 0) {
                    const items = filteredParams.map(p => {
                        let sym = String(p.symbol || '').trim();
                        // LaTeX math symbol normalization
                        if (sym === 'Co' || sym === 'CO') sym = 'C_o';
                        else if (sym === 'Pv' || sym === 'PV') sym = 'P_v';
                        else if (sym === 'Pvo') sym = 'P_{vo}';
                        else if (sym === 'VPC') sym = 'V_{PC}';
                        else if (sym === 'Vo') sym = 'V_o';
                        else if (sym === 'Do') sym = 'D_o';
                        else if (sym === 'Di') sym = 'D_i';
                        else if (sym === 'Wo') sym = 'W_o';
                        else if (sym === 'Ho') sym = 'H_o';
                        else if (sym === 'Qo') sym = 'Q_o';
                        else if (sym === 'RHO' || sym === 'rho') sym = '\\rho';
                        else if (sym === 'Theta' || sym === 'theta') sym = '\\theta';
                        else if (sym.includes('_') && !sym.includes('{')) {
                            sym = sym.replace(/_([a-zA-Z0-9]+)/g, '_{$1}');
                        }

                        let name = String(p.name || '').trim();
                        name = name.replace(/^Input parameter\s+/i, '').trim();
                        if (name.endsWith(':')) name = name.slice(0, -1).trim();

                        const nameClean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const symClean = String(p.symbol || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const isRedundantName = !name || nameClean === symClean || nameClean === ('inputparameter' + symClean);

                        const valStr = escapeHtml(String(p.value !== undefined && p.value !== null ? p.value : ''));

                        if (isRedundantName) {
                            return `
                                <div class="tb-param-item">
                                    <span class="tb-param-sym">$${sym}$ =</span>
                                    <span class="tb-param-val">${valStr}</span>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="tb-param-item">
                                    <span class="tb-param-sym">$${sym}$</span>
                                    <span class="tb-param-name">(${escapeHtml(name)}):</span>
                                    <span class="tb-param-val">${valStr}</span>
                                </div>
                            `;
                        }
                    }).join('');

                    paramsHtml = `
                        <div class="tb-block tb-params-block">
                            <div class="tb-block-label"><span class="tb-label-icon">📋</span> Known Parameters &amp; Boundary Conditions</div>
                            <div class="tb-params-grid">${items}</div>
                        </div>
                    `;
                }
            }

            // 4. Derivation & Algebraic Substitution
            let derivationHtml = '';
            if (st.derivation_latex && st.derivation_latex.length > 0) {
                const lines = st.derivation_latex.map(line => `
                    <div class="tb-derivation-line">$$${line}$$</div>
                `).join('');
                derivationHtml = `
                    <div class="tb-block tb-derivation-block">
                        <div class="tb-block-label"><span class="tb-label-icon">✏️</span> Substitution &amp; Step-by-Step Evaluation</div>
                        <div class="tb-derivations-list">${lines}</div>
                    </div>
                `;
            } else if (st.substitution) {
                derivationHtml = `
                    <div class="tb-block tb-derivation-block">
                        <div class="tb-block-label"><span class="tb-label-icon">✏️</span> Substitution &amp; Step-by-Step Evaluation</div>
                        <div class="tb-subst-text">${escapeHtml(st.substitution)}</div>
                    </div>
                `;
            }

            // 5. Numerical / Iteration Note
            let methodHtml = '';
            if (st.method_note) {
                methodHtml = `
                    <div class="tb-method-note">
                        <span class="tb-note-icon">⚙️</span>
                        <span class="tb-note-text">${escapeHtml(st.method_note)}</span>
                    </div>
                `;
            }

            // 6. Framed Final Result (College Textbook Double-Border Box)
            let answerHtml = '';
            const resLatex = st.result_latex || st.framed_result_latex;
            const resPlain = st.result || st.framed_result;
            if (resLatex) {
                answerHtml = `
                    <div class="tb-answer-row">
                        <div class="tb-answer-box">
                            <span class="tb-answer-tag">Result:</span>
                            <span class="tb-answer-math">$$${resLatex}$$</span>
                        </div>
                    </div>
                `;
            } else if (resPlain) {
                answerHtml = `
                    <div class="tb-answer-row">
                        <div class="tb-answer-box">
                            <span class="tb-answer-tag">Result:</span>
                            <span class="tb-plain-val">${escapeHtml(resPlain)}</span>
                        </div>
                    </div>
                `;
            }

            // 7. Educational / Engineering Commentary
            let notesHtml = '';
            const noteText = st.notes || st.explanation;
            if (noteText) {
                notesHtml = `
                    <div class="tb-commentary">
                        <span class="tb-comm-icon">📖</span>
                        <span class="tb-comm-text"><strong>Textbook Commentary:</strong> ${escapeHtml(noteText)}</span>
                    </div>
                `;
            }

            // Assemble Card HTML
            card.innerHTML = `
                <div class="tb-step-header">
                    <div class="tb-header-left">
                        <span class="tb-step-badge">${stepLabel}</span>
                        <h4 class="tb-step-title">${stepTitle}</h4>
                    </div>
                    ${citationHtml}
                </div>
                ${governingHtml}
                ${paramsHtml}
                ${derivationHtml}
                ${methodHtml}
                ${answerHtml}
                ${notesHtml}
            `;

            elements.formulasContainer.appendChild(card);
        });

        // Trigger KaTeX math rendering on the entire container
        applyKatexToFormulas();
        if (state.isCalcFullscreen) {
            updateCalcFsHeader();
        }
    }

    function applyKatexToFormulas() {
        if (window.renderMathInElement && elements.formulasContainer) {
            try {
                window.renderMathInElement(elements.formulasContainer, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (err) {
                console.warn("KaTeX render notice:", err);
            }
        } else {
            // KaTeX may still be initializing, retry once after short delay
            setTimeout(() => {
                if (window.renderMathInElement && elements.formulasContainer) {
                    try {
                        window.renderMathInElement(elements.formulasContainer, {
                            delimiters: [
                                { left: '$$', right: '$$', display: true },
                                { left: '$', right: '$', display: false },
                                { left: '\\(', right: '\\)', display: false },
                                { left: '\\[', right: '\\]', display: true }
                            ],
                            throwOnError: false
                        });
                    } catch (e) {}
                }
            }, 100);
        }
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function hasInput(id) {
        return !!document.getElementById("input-" + id);
    }

    // --- Official Vector SVG Blueprint Cache & Loader ---
    const svgBlueprintCache = new Map();

    async function loadOfficialSvgBlueprint(imgCode) {
        if (!imgCode) return null;
        if (svgBlueprintCache.has(imgCode)) {
            return svgBlueprintCache.get(imgCode);
        }
        try {
            const resp = await fetch(`/static/fittings_svg/${imgCode}.svg`);
            if (resp.ok) {
                const text = await resp.text();
                svgBlueprintCache.set(imgCode, text);
                return text;
            }
        } catch (e) {
            console.warn("Could not load SVG blueprint for", imgCode, e);
        }
        return null;
    }

    function applySvgBlueprintToCad(svgText) {
        if (!svgText || !elements.cadSvg) return;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, "image/svg+xml");
            const docSvg = doc.querySelector("svg");
            if (docSvg) {
                const vb = docSvg.getAttribute("viewBox") || "0 0 32000 20000";
                elements.cadSvg.setAttribute("viewBox", vb);
                elements.cadSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
                elements.cadSvg.innerHTML = docSvg.innerHTML;
            }
        } catch (err) {
            console.error("Failed to parse SVG blueprint:", err);
        }
    }

    // --- ASHRAE Duct Fitting Code Decoder & Guide Modal ---
    function decodeFittingCode(rawCode) {
        if (!rawCode) return null;
        const code = rawCode.trim().toUpperCase();
        const match = code.match(/^([SEC])([DRF])(\d+)(?:-(\d+))?$/);
        if (!match) {
            return {
                valid: false,
                code: code,
                error: `Code "${code}" does not match standard ASHRAE format (e.g. CR3-1, ED5-1, CD11-1).`
            };
        }

        const [_, fnChar, geoChar, catChar, seqChar] = match;

        const fnMap = {
            'S': { name: 'Supply Air System', desc: 'Used in supply air distribution (exits, diffusers, diverging junctions)', badgeClass: 'badge-s' },
            'E': { name: 'Exhaust / Return System', desc: 'Used in exhaust and return air streams (entries/intakes, converging junctions, hoods)', badgeClass: 'badge-e' },
            'C': { name: 'Common (Supply & Return)', desc: 'Common to both supply and return/exhaust systems (equal-area elbows, straight duct, dampers)', badgeClass: 'badge-c' }
        };

        const geoMap = {
            'D': { name: 'Round Duct (Diameter)', desc: 'Circular duct defined by internal diameter (D or Ø). Most friction-efficient geometry.', badgeClass: 'badge-d' },
            'R': { name: 'Rectangular Duct', desc: 'Rectangular duct defined by Height × Width (H × W). Huebscher circular equivalent De.', badgeClass: 'badge-r' },
            'F': { name: 'Flat Oval Duct', desc: 'Flat oval duct defined by Major × Minor Axis (A × a). Heyt-Diaz circular equivalent.', badgeClass: 'badge-f' }
        };

        const catMap = {
            '1': { name: 'Entries (Intakes)', desc: 'Bellmouth inlets, smooth flanged/unflanged entries, suction openings' },
            '2': { name: 'Exits (Discharges)', desc: 'Diffusers, discharge cones, registers, louvers, plenums discharging to room' },
            '3': { name: 'Elbows (Bends)', desc: 'Smooth radius bends (with/without turning vanes), mitered elbows, segmented bends' },
            '4': { name: 'Transitions', desc: 'Cross-section area changes, reducers, expansions, offsets, round-to-rectangular adapters' },
            '5': { name: 'Junctions', desc: 'Dividing (supply) or converging (exhaust) tees, wyes, 90° straight taps, 45° lateral taps, crosses' },
            '6': { name: 'Obstructions', desc: 'Internal pipes, structural beams, rods, and conduits passing through duct airway' },
            '7': { name: 'Fan & System Interactions', desc: 'Fan inlet boxes, blast plates, diffuser cones, System Effect Factors (SEF)' },
            '8': { name: 'Duct-Mounted Equipment', desc: 'Heating/cooling coils, air filters, single-duct VAV terminal boxes, sound attenuators' },
            '9': { name: 'Dampers', desc: 'Opposed-blade, parallel-blade volume dampers, butterfly, backdraft, fire dampers' },
            '10': { name: 'Hoods', desc: 'Canopy hoods, kitchen capture hoods, lateral exhaust slots, enclosing hoods' },
            '11': { name: 'Straight Duct', desc: 'Straight duct runs, Darcy-Weisbach friction rate, Colebrook friction factor (f) [Eq. 19], auto-sizing' }
        };

        return {
            valid: true,
            code: code,
            fn: { char: fnChar, ...(fnMap[fnChar] || { name: 'Unknown Function', badgeClass: 'badge-c' }) },
            geo: { char: geoChar, ...(geoMap[geoChar] || { name: 'Unknown Geometry', badgeClass: 'badge-r' }) },
            cat: { char: catChar, ...(catMap[catChar] || { name: `Category ${catChar}`, desc: 'Specialized fitting category' }) },
            seq: seqChar || '1'
        };
    }

    function updateCodeDecoderView(codeStr) {
        if (!elements.decoderResultChips) return;
        const res = decodeFittingCode(codeStr);
        if (!res || !res.valid) {
            elements.decoderResultChips.innerHTML = `
                <div class="decoder-summary-text" style="border-left-color: #e11d48; color: #9f1239;">
                    ⚠️ ${res ? res.error : "Please enter an ASHRAE fitting code to decode."}
                </div>
            `;
            return;
        }

        elements.decoderResultChips.innerHTML = `
            <div class="decoder-chip">
                <span class="chip-tag">1. Function:</span>
                <span class="badge-code ${res.fn.badgeClass}">${res.fn.char}</span>
                <span class="chip-val">${res.fn.name}</span>
            </div>
            <div class="decoder-chip">
                <span class="chip-tag">2. Shape:</span>
                <span class="badge-code ${res.geo.badgeClass}">${res.geo.char}</span>
                <span class="chip-val">${res.geo.name}</span>
            </div>
            <div class="decoder-chip">
                <span class="chip-tag">3. Category:</span>
                <span class="badge-code" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;">${res.cat.char}</span>
                <span class="chip-val">${res.cat.name}</span>
            </div>
            <div class="decoder-chip">
                <span class="chip-tag">4. Variant:</span>
                <span class="badge-code" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">#${res.seq}</span>
            </div>
            <div class="decoder-summary-text">
                📌 <strong>${res.code}</strong>: <strong>${res.fn.name}</strong>, <strong>${res.geo.name}</strong>, <strong>${res.cat.name}</strong> variation #${res.seq}. <em>(${res.cat.desc})</em>.
            </div>
        `;
    }

    function openFittingCodeModal(code) {
        const targetCode = code || state.activeCode || "CR3-1";
        if (elements.codeDecoderInput) {
            elements.codeDecoderInput.value = targetCode;
        }
        updateCodeDecoderView(targetCode);
        if (elements.fittingCodeModal) {
            elements.fittingCodeModal.classList.remove("hidden");
            if (elements.codeDecoderInput) {
                elements.codeDecoderInput.focus();
                elements.codeDecoderInput.select();
            }
        }
    }

    function closeFittingCodeModal() {
        if (elements.fittingCodeModal) {
            elements.fittingCodeModal.classList.add("hidden");
        }
    }

    // --- ASHRAE Absolute Roughness Material Picker Modal Logic ---
    function openRoughnessModal(targetFieldId) {
        state.targetRoughnessFieldId = targetFieldId || "e";
        const isSi = state.unit === "SI";

        if (elements.roughnessModalTitle) {
            elements.roughnessModalTitle.textContent = isSi ? "Absolute Roughness (mm)" : "Absolute Roughness (ft)";
        }

        const inp = document.getElementById(`input-${state.targetRoughnessFieldId}`)
                 || document.getElementById("input-ei")
                 || document.getElementById("input-e");
        const currentVal = inp ? parseFloat(inp.value) : (isSi ? 0.090 : 0.0003);

        let matchedIdx = -1;
        if (state.selectedRoughnessMaterial) {
            matchedIdx = ASHRAE_ROUGHNESS_MATERIALS.findIndex(
                m => m.name.toLowerCase() === state.selectedRoughnessMaterial.toLowerCase()
            );
        }
        if (matchedIdx === -1 && !isNaN(currentVal)) {
            matchedIdx = ASHRAE_ROUGHNESS_MATERIALS.findIndex(m => {
                const v = parseFloat(isSi ? m.si : m.ip);
                return Math.abs(v - currentVal) < 0.0005;
            });
            if (matchedIdx === -1) {
                let minDiff = Infinity;
                ASHRAE_ROUGHNESS_MATERIALS.forEach((m, idx) => {
                    const diff = Math.abs(parseFloat(isSi ? m.si : m.ip) - currentVal);
                    if (diff < minDiff) {
                        minDiff = diff;
                        matchedIdx = idx;
                    }
                });
            }
        }
        if (matchedIdx < 0) matchedIdx = 3;
        state.activeRoughnessIndex = matchedIdx;

        renderRoughnessList();

        if (elements.roughnessModalBackdrop) {
            elements.roughnessModalBackdrop.classList.add("open");
            setTimeout(() => {
                if (elements.roughnessListContainer) {
                    elements.roughnessListContainer.focus();
                }
            }, 60);
        }
    }

    function closeRoughnessModal() {
        if (elements.roughnessModalBackdrop) {
            elements.roughnessModalBackdrop.classList.remove("open");
        }
    }

    function renderRoughnessList() {
        if (!elements.roughnessListContainer) return;
        elements.roughnessListContainer.innerHTML = "";
        const isSi = state.unit === "SI";

        ASHRAE_ROUGHNESS_MATERIALS.forEach((mat, idx) => {
            const itemDiv = document.createElement("div");
            itemDiv.className = `roughness-item ${idx === state.activeRoughnessIndex ? "selected" : ""}`;
            itemDiv.dataset.index = idx;

            const valSpan = document.createElement("span");
            valSpan.className = "r-val";
            valSpan.textContent = isSi ? mat.si : mat.ip;

            const nameSpan = document.createElement("span");
            nameSpan.className = "r-name";
            nameSpan.textContent = mat.name;

            itemDiv.appendChild(valSpan);
            itemDiv.appendChild(nameSpan);

            itemDiv.addEventListener("click", () => {
                selectRoughnessIndex(idx);
            });

            itemDiv.addEventListener("dblclick", () => {
                selectRoughnessIndex(idx);
                applySelectedRoughness();
            });

            elements.roughnessListContainer.appendChild(itemDiv);

            if (idx === state.activeRoughnessIndex) {
                setTimeout(() => itemDiv.scrollIntoView({ block: "nearest" }), 20);
            }
        });
    }

    function selectRoughnessIndex(idx) {
        if (idx < 0 || idx >= ASHRAE_ROUGHNESS_MATERIALS.length) return;
        state.activeRoughnessIndex = idx;
        const allItems = elements.roughnessListContainer.querySelectorAll(".roughness-item");
        allItems.forEach((el, i) => {
            el.classList.toggle("selected", i === idx);
            if (i === idx) {
                el.scrollIntoView({ block: "nearest" });
            }
        });
    }

    function applySelectedRoughness() {
        const mat = ASHRAE_ROUGHNESS_MATERIALS[state.activeRoughnessIndex];
        if (!mat) {
            closeRoughnessModal();
            return;
        }

        const isSi = state.unit === "SI";
        const chosenVal = isSi ? mat.si : mat.ip;
        state.selectedRoughnessMaterial = mat.name;
        state.userRoughnessValue = chosenVal;

        const inp = document.getElementById(`input-${state.targetRoughnessFieldId}`)
                 || document.getElementById("input-ei")
                 || document.getElementById("input-e");
        if (inp) {
            inp.value = chosenVal;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const badge = document.getElementById("lblRoughnessMatName") || document.querySelector(".roughness-mat-badge");
        if (badge) {
            badge.textContent = mat.name;
        }

        closeRoughnessModal();
        calculate();
    }

    // --- CAD Vector Technical Drawing Generator & Official Blueprint Presenter ---
    function renderCadDrawing() {
        const svg = elements.cadSvg;
        const u = state.unit;
        const showVal = state.showValuesInDrawing;
        const d = state.activeData || {};
        const code = state.activeCode || "CR11-1";
        const item = state.activeItem || {};

        // 1. Resolve Official High-Res Blueprint Image
        let imgCode = code;
        if (imgCode === "SIZE-RECT") imgCode = "CR11-1";
        else if (imgCode === "SIZE-ROUND") imgCode = "CD11-1";
        else if (imgCode === "SD5-34") imgCode = "SD5-4";

        const targetSrc = (item && item.blueprint) ? item.blueprint : `/static/blueprints/${imgCode}.png`;
        let imgReady = false;

        // Prefetch SVG blueprint so switching to vector mode is instantaneous
        loadOfficialSvgBlueprint(imgCode);

        if (elements.cadOfficialImg) {
            elements.cadOfficialImg.alt = formatFittingTitle(item);

            elements.cadOfficialImg.onload = () => {
                if (state.diagramMode === "official") {
                    elements.cadOfficialImg.classList.remove("hidden");
                    if (elements.cadSvg) elements.cadSvg.classList.add("hidden");
                }
            };

            elements.cadOfficialImg.onerror = () => {
                // Seamless fallback to dynamic parametric SVG CAD if image fails or missing
                elements.cadOfficialImg.classList.add("hidden");
                if (elements.cadSvg) elements.cadSvg.classList.remove("hidden");
            };

            if (elements.cadOfficialImg.getAttribute("src") !== targetSrc) {
                elements.cadOfficialImg.src = targetSrc;
            } else if (elements.cadOfficialImg.complete && elements.cadOfficialImg.naturalWidth > 0) {
                imgReady = true;
            }
        }

        // 2. View Mode Toggle (Official Blueprint vs Parametric Vector CAD)
        if (state.diagramMode === "official") {
            if (elements.lblDiagramMode) elements.lblDiagramMode.textContent = "Official Blueprint";
            if (imgReady) {
                if (elements.cadOfficialImg) elements.cadOfficialImg.classList.remove("hidden");
                if (elements.cadSvg) elements.cadSvg.classList.add("hidden");
            } else {
                // Keep dynamic CAD visible while image loads to eliminate any blank white delay
                if (elements.cadSvg) elements.cadSvg.classList.remove("hidden");
                if (elements.cadOfficialImg) elements.cadOfficialImg.classList.remove("hidden");
            }
        } else {
            if (elements.cadOfficialImg) elements.cadOfficialImg.classList.add("hidden");
            if (elements.cadSvg) elements.cadSvg.classList.remove("hidden");
            if (elements.lblDiagramMode) elements.lblDiagramMode.textContent = "Live Vector CAD";
        }

        // 3. Live Dimensions Badge Overlay (when "Display Values in Drawing" is checked)
        let qVal = getInputVal("Q", getInputVal("Qc", 2000));
        let qUnit = u === "SI" ? "L/s" : "cfm";
        let vVal = (elements.outV && elements.outV.textContent !== "-") ? elements.outV.textContent : getInputVal("V", "-");
        let dpVal = elements.outDp ? elements.outDp.textContent : "-";
        let lossUnit = u === "SI" ? "Pa" : "in. wg";

        if (showVal && elements.liveDimsBadge && elements.badgeContent) {
            let dimParts = [];
            if (hasInput("H") && hasInput("W")) {
                let h = getInputVal("H", 300);
                let w = getInputVal("W", 300);
                let unitStr = u === "SI" ? "mm" : "in.";
                dimParts.push(`H × W: ${h} × ${w} ${unitStr}`);
            } else if (hasInput("D")) {
                let diam = getInputVal("D", 300);
                let unitStr = u === "SI" ? "mm" : "in.";
                dimParts.push(`Ø D: ${diam} ${unitStr}`);
            }
            if (hasInput("L")) {
                let l = getInputVal("L", 3);
                let lUnit = u === "SI" ? "m" : "ft";
                dimParts.push(`L: ${l} ${lUnit}`);
            }
            dimParts.push(`Flow: ${qVal} ${qUnit}`);
            dimParts.push(`V: ${vVal} ${u === "SI" ? "m/s" : "fpm"}`);
            dimParts.push(`Loss: ${dpVal} ${lossUnit}`);

            elements.badgeContent.textContent = dimParts.join("  |  ");
            elements.liveDimsBadge.classList.remove("hidden");
        } else if (elements.liveDimsBadge) {
            elements.liveDimsBadge.classList.add("hidden");
        }

        // 4. Render Live Vector CAD (Exact Mathematical Geometry from Official Blueprint SVG)
        const cachedSvg = svgBlueprintCache.get(imgCode);
        if (cachedSvg) {
            applySvgBlueprintToCad(cachedSvg);
        } else {
            loadOfficialSvgBlueprint(imgCode).then(svgText => {
                if (svgText && (state.activeCode === code || (code === "SIZE-RECT" && imgCode === "CR11-1") || (code === "SIZE-ROUND" && imgCode === "CD11-1"))) {
                    applySvgBlueprintToCad(svgText);
                }
            });
        }
    }

    // --- CAD Helper: Straight Rectangular Duct (Exact Match to Screenshot 1) ---
    function drawStraightRectDuct(group, d, qLabel, lLabel, showVal, u) {
        const ductLeft = 230;
        const ductRight = 520;
        const ductTop = 110;
        const ductBottom = 210;
        const centerY = (ductTop + ductBottom) / 2;

        let dimLabel = "H × W";
        if (showVal) {
            const h = getInputVal("H", 300);
            const w = getInputVal("W", 300);
            dimLabel = u === "SI" ? `${h} × ${w}` : `${h}" × ${w}"`;
        }

        group.innerHTML += `
            <!-- Top & Bottom Duct Boundary Lines -->
            <line x1="${ductLeft}" y1="${ductTop}" x2="${ductRight}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${ductLeft}" y1="${ductBottom}" x2="${ductRight}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />

            <!-- Authentic Mechanical Break Lines -->
            ${createBreakLine(ductLeft, ductTop - 14, ductBottom + 14)}
            ${createBreakLine(ductRight, ductTop - 14, ductBottom + 14)}

            <!-- Left Airflow Arrow Q -->
            <line x1="180" y1="${centerY}" x2="295" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="235" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <!-- Center Dimensions H x W -->
            <text x="375" y="${centerY + 6}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle" letter-spacing="1.5">${dimLabel}</text>

            <!-- Right Discharge Flow Arrow -->
            <line x1="465" y1="${centerY}" x2="565" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />

            <!-- Dimension Line Length L with Extension Lines -->
            <line x1="${ductLeft}" y1="${ductBottom + 6}" x2="${ductLeft}" y2="285" stroke="#000000" stroke-width="1.0" />
            <line x1="${ductRight}" y1="${ductBottom + 6}" x2="${ductRight}" y2="285" stroke="#000000" stroke-width="1.0" />
            <line x1="${ductLeft}" y1="275" x2="350" y2="275" stroke="#000000" stroke-width="1.2" marker-start="url(#arrowLeft)" />
            <text x="375" y="280" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${lLabel}</text>
            <line x1="400" y1="275" x2="${ductRight}" y2="275" stroke="#000000" stroke-width="1.2" marker-end="url(#arrowRight)" />
        `;
    }

    // --- CAD Helper: Straight Round Duct ---
    function drawStraightRoundDuct(group, d, qLabel, lLabel, showVal, u) {
        const ductLeft = 230;
        const ductRight = 520;
        const ductTop = 110;
        const ductBottom = 210;
        const centerY = (ductTop + ductBottom) / 2;

        let dimLabel = "Ø D";
        if (showVal) {
            const diam = getInputVal("D", 300);
            dimLabel = u === "SI" ? `Ø ${diam}` : `Ø ${diam}"`;
        }

        group.innerHTML += `
            <line x1="${ductLeft}" y1="${ductTop}" x2="${ductRight}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${ductLeft}" y1="${ductBottom}" x2="${ductRight}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />

            <!-- Centerline Dash-Dot -->
            <line x1="${ductLeft - 20}" y1="${centerY}" x2="${ductRight + 20}" y2="${centerY}" stroke="#555555" stroke-width="1.0" stroke-dasharray="16, 4, 3, 4" />

            ${createBreakLine(ductLeft, ductTop - 14, ductBottom + 14)}
            ${createBreakLine(ductRight, ductTop - 14, ductBottom + 14)}

            <line x1="170" y1="${centerY - 25}" x2="280" y2="${centerY - 25}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="225" y="${centerY - 35}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <text x="375" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle" letter-spacing="1.5">${dimLabel}</text>

            <line x1="${ductLeft}" y1="${ductBottom + 6}" x2="${ductLeft}" y2="285" stroke="#000000" stroke-width="1.0" />
            <line x1="${ductRight}" y1="${ductBottom + 6}" x2="${ductRight}" y2="285" stroke="#000000" stroke-width="1.0" />
            <line x1="${ductLeft}" y1="275" x2="350" y2="275" stroke="#000000" stroke-width="1.2" marker-start="url(#arrowLeft)" />
            <text x="375" y="280" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${lLabel}</text>
            <line x1="400" y1="275" x2="${ductRight}" y2="275" stroke="#000000" stroke-width="1.2" marker-end="url(#arrowRight)" />
        `;
    }

    // --- CAD Helper: Straight Flat Oval Duct ---
    function drawStraightOvalDuct(group, d, qLabel, lLabel, showVal, u) {
        const ductLeft = 230;
        const ductRight = 520;
        const ductTop = 115;
        const ductBottom = 205;
        const centerY = (ductTop + ductBottom) / 2;

        let dimLabel = "a × A";
        if (showVal) {
            const a = getInputVal("a", 200);
            const A = getInputVal("A", 400);
            dimLabel = u === "SI" ? `${a} × ${A}` : `${a}" × ${A}"`;
        }

        group.innerHTML += `
            <line x1="${ductLeft}" y1="${ductTop}" x2="${ductRight}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${ductLeft}" y1="${ductBottom}" x2="${ductRight}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />

            ${createBreakLine(ductLeft, ductTop - 14, ductBottom + 14)}
            ${createBreakLine(ductRight, ductTop - 14, ductBottom + 14)}

            <line x1="180" y1="${centerY}" x2="295" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="235" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <text x="375" y="${centerY + 6}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle" letter-spacing="1.5">${dimLabel}</text>

            <line x1="${ductLeft}" y1="${ductBottom + 6}" x2="${ductLeft}" y2="285" stroke="#000000" stroke-width="1.0" />
            <line x1="${ductRight}" y1="${ductBottom + 6}" x2="${ductRight}" y2="285" stroke="#000000" stroke-width="1.0" />
            <line x1="${ductLeft}" y1="275" x2="350" y2="275" stroke="#000000" stroke-width="1.2" marker-start="url(#arrowLeft)" />
            <text x="375" y="280" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${lLabel}</text>
            <line x1="400" y1="275" x2="${ductRight}" y2="275" stroke="#000000" stroke-width="1.2" marker-end="url(#arrowRight)" />
        `;
    }

    // --- CAD Helper: Bellmouth Plenum (SD1-1) ---
    function drawBellmouthPlenum(group, d, qLabel, showVal, u) {
        const wallX = 220;
        const ductRight = 540;
        const ductTop = 110;
        const ductBottom = 210;
        const centerY = (ductTop + ductBottom) / 2;
        const r = 35;

        group.innerHTML += `
            <!-- Plenum Wall -->
            <line x1="${wallX}" y1="50" x2="${wallX}" y2="${ductTop - r}" stroke="#000000" stroke-width="2.5" />
            <line x1="${wallX}" y1="${ductBottom + r}" x2="${wallX}" y2="280" stroke="#000000" stroke-width="2.5" />

            <!-- Smooth Bellmouth Radii -->
            <path d="M ${wallX} ${ductTop - r} A ${r} ${r} 0 0 0 ${wallX + r} ${ductTop} L ${ductRight} ${ductTop}" stroke="#000000" stroke-width="1.8" fill="none" />
            <path d="M ${wallX} ${ductBottom + r} A ${r} ${r} 0 0 1 ${wallX + r} ${ductBottom} L ${ductRight} ${ductBottom}" stroke="#000000" stroke-width="1.8" fill="none" />

            ${createBreakLine(ductRight, ductTop - 14, ductBottom + 14)}

            <!-- Entering Plenum Airflow -->
            <line x1="140" y1="${centerY}" x2="270" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="175" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <!-- Bellmouth Radius Annotation -->
            <path d="M ${wallX + 10} ${ductTop - 10} L ${wallX + 22} ${ductTop + 2}" stroke="#000000" stroke-width="1.0" marker-end="url(#arrowRight)" />
            <text x="${wallX + 40}" y="${ductTop - 15}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000">r</text>

            <!-- Duct Diameter Label -->
            <line x1="420" y1="${ductTop}" x2="420" y2="${ductBottom}" stroke="#000000" stroke-width="1.0" marker-start="url(#arrowLeft)" marker-end="url(#arrowRight)" />
            <text x="435" y="${centerY + 4}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">D</text>
        `;
    }

    // --- CAD Helper: Exit & Diffuser ---
    function drawExitDiffuser(group, d, qLabel, showVal, u) {
        const ductLeft = 180;
        const transX = 350;
        const exitX = 520;
        const ductTop = 120;
        const ductBottom = 200;
        const exitTop = 80;
        const exitBottom = 240;
        const centerY = (ductTop + ductBottom) / 2;

        group.innerHTML += `
            <line x1="${ductLeft}" y1="${ductTop}" x2="${transX}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${ductLeft}" y1="${ductBottom}" x2="${transX}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />
            
            <!-- Expanding Diffuser Cone -->
            <line x1="${transX}" y1="${ductTop}" x2="${exitX}" y2="${exitTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${transX}" y1="${ductBottom}" x2="${exitX}" y2="${exitBottom}" stroke="#000000" stroke-width="1.8" />
            <line x1="${exitX}" y1="${exitTop}" x2="${exitX}" y2="${exitBottom}" stroke="#000000" stroke-width="1.8" />

            ${createBreakLine(ductLeft, ductTop - 12, ductBottom + 12)}

            <!-- Flow Arrows -->
            <line x1="140" y1="${centerY}" x2="250" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="180" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <line x1="450" y1="${centerY}" x2="560" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="590" y="${centerY + 4}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000">Exit</text>
        `;
    }

    // --- CAD Helper: 90 Deg Smooth Radius Elbow (CR3-1 / CD3-1) ---
    function drawSmoothElbow(group, d, qLabel, showVal, u) {
        const cx = 250;
        const cy = 230;
        const rInner = 80;
        const rOuter = 160;

        group.innerHTML += `
            <!-- 90 Deg Smooth Elbow Arc -->
            <path d="M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 0 1 ${cx + rOuter} ${cy}" stroke="#000000" stroke-width="1.8" fill="none" />
            <path d="M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 0 1 ${cx + rInner} ${cy}" stroke="#000000" stroke-width="1.8" fill="none" />

            <!-- Tangent Extensions -->
            <line x1="${cx - 60}" y1="${cy - rOuter}" x2="${cx}" y2="${cy - rOuter}" stroke="#000000" stroke-width="1.8" />
            <line x1="${cx - 60}" y1="${cy - rInner}" x2="${cx}" y2="${cy - rInner}" stroke="#000000" stroke-width="1.8" />
            ${createBreakLine(cx - 60, cy - rOuter - 10, cy - rInner + 10)}

            <line x1="${cx + rOuter}" y1="${cy}" x2="${cx + rOuter}" y2="${cy + 60}" stroke="#000000" stroke-width="1.8" />
            <line x1="${cx + rInner}" y1="${cy}" x2="${cx + rInner}" y2="${cy + 60}" stroke="#000000" stroke-width="1.8" />
            ${createBreakLine(cx + rInner - 10, cy + 60, cx + rOuter + 10)}

            <!-- Flow Arrows -->
            <line x1="${cx - 40}" y1="${cy - (rInner + rOuter) / 2}" x2="${cx + 30}" y2="${cy - (rInner + rOuter) / 2}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="${cx - 10}" y="${cy - (rInner + rOuter) / 2 - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <line x1="${cx + (rInner + rOuter) / 2}" y1="${cy + 10}" x2="${cx + (rInner + rOuter) / 2}" y2="${cy + 75}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
        `;
    }

    // --- CAD Helper: Smooth Radius with Splitter Vane (CR3-3) ---
    function drawSmoothElbowWithVane(group, d, qLabel, showVal, u) {
        const cx = 250;
        const cy = 230;
        const rInner = 80;
        const rOuter = 160;
        const rMid = 120;

        group.innerHTML += `
            <path d="M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 0 1 ${cx + rOuter} ${cy}" stroke="#000000" stroke-width="1.8" fill="none" />
            <path d="M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 0 1 ${cx + rInner} ${cy}" stroke="#000000" stroke-width="1.8" fill="none" />
            <!-- Splitter Vane -->
            <path d="M ${cx} ${cy - rMid} A ${rMid} ${rMid} 0 0 1 ${cx + rMid} ${cy}" stroke="#000000" stroke-width="2.0" stroke-dasharray="8, 3" fill="none" />

            <line x1="${cx - 60}" y1="${cy - rOuter}" x2="${cx}" y2="${cy - rOuter}" stroke="#000000" stroke-width="1.8" />
            <line x1="${cx - 60}" y1="${cy - rInner}" x2="${cx}" y2="${cy - rInner}" stroke="#000000" stroke-width="1.8" />
            ${createBreakLine(cx - 60, cy - rOuter - 10, cy - rInner + 10)}

            <line x1="${cx + rOuter}" y1="${cy}" x2="${cx + rOuter}" y2="${cy + 60}" stroke="#000000" stroke-width="1.8" />
            <line x1="${cx + rInner}" y1="${cy}" x2="${cx + rInner}" y2="${cy + 60}" stroke="#000000" stroke-width="1.8" />
            ${createBreakLine(cx + rInner - 10, cy + 60, cx + rOuter + 10)}

            <line x1="${cx - 40}" y1="${cy - (rInner + rOuter) / 2}" x2="${cx + 30}" y2="${cy - (rInner + rOuter) / 2}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="${cx - 10}" y="${cy - (rInner + rOuter) / 2 - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>
            <text x="${cx + rMid + 15}" y="${cy - 20}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000">Splitter Vane</text>
        `;
    }

    // --- CAD Helper: Mitered Elbow without Vanes (CR3-6) ---
    function drawMiteredNoVanesElbow(group, d, qLabel, showVal, u) {
        const leftX = 160;
        const cornerX = 390;
        const topY = 70;
        const innerX = 270;
        const innerY = 190;
        const bottomY = 290;

        let dimLabel = "W × H";
        if (showVal) {
            const w = getInputVal("W", 300);
            const h = getInputVal("H", 300);
            dimLabel = u === "SI" ? `${w} × ${h}` : `${w}" × ${h}"`;
        }

        group.innerHTML += `
            <line x1="${leftX}" y1="${topY}" x2="${cornerX}" y2="${topY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${leftX}" y1="${innerY}" x2="${innerX}" y2="${innerY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${innerX}" y1="${innerY}" x2="${innerX}" y2="${bottomY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${cornerX}" y1="${topY}" x2="${cornerX}" y2="${bottomY}" stroke="#000000" stroke-width="2.0" />

            <!-- Diagonal Miter Line -->
            <line x1="${innerX}" y1="${innerY}" x2="${cornerX}" y2="${topY}" stroke="#000000" stroke-width="1.2" stroke-dasharray="6, 3" />

            ${createBreakLine(leftX, topY - 12, innerY + 12)}
            ${createBreakLine(innerX - 12, bottomY, cornerX + 12)}

            <line x1="100" y1="${(topY + innerY)/2}" x2="210" y2="${(topY + innerY)/2}" stroke="#000000" stroke-width="1.8" marker-end="url(#arrowRight)" />
            <text x="155" y="${(topY + innerY)/2 - 12}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>
            <text x="155" y="${(topY + innerY)/2 + 18}" font-family="Arial, sans-serif" font-size="12" fill="#000000" text-anchor="middle">Aₒ</text>

            <line x1="${(innerX + cornerX)/2}" y1="210" x2="${(innerX + cornerX)/2}" y2="270" stroke="#000000" stroke-width="1.8" marker-end="url(#arrowRight)" />
            <text x="${(innerX + cornerX)/2}" y="240" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${dimLabel}</text>
        `;
    }

    // --- CAD Helper: Mitered Elbow with Single-Thickness Vanes (CR3-12) ---
    function drawMiteredSingleVanesElbow(group, d, qLabel, showVal, u) {
        const leftX = 140;
        const cornerX = 370;
        const topY = 70;
        const innerX = 250;
        const innerY = 190;
        const bottomY = 290;

        let dimLabel = "W × H";
        if (showVal) {
            const w = getInputVal("W", 300);
            const h = getInputVal("H", 300);
            dimLabel = u === "SI" ? `${w} × ${h}` : `${w}" × ${h}"`;
        }

        let vanesSvg = "";
        const numVanes = 6;
        for (let i = 1; i <= numVanes; i++) {
            const t = i / (numVanes + 1);
            const vx = innerX + t * (cornerX - innerX);
            const vy = innerY + t * (topY - innerY);
            vanesSvg += `<path d="M ${vx - 14} ${vy - 10} Q ${vx + 2} ${vy - 2} ${vx + 14} ${vy + 10}" fill="none" stroke="#000000" stroke-width="2.2" />`;
        }

        group.innerHTML += `
            <line x1="${leftX}" y1="${topY}" x2="${cornerX}" y2="${topY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${leftX}" y1="${innerY}" x2="${innerX}" y2="${innerY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${innerX}" y1="${innerY}" x2="${innerX}" y2="${bottomY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${cornerX}" y1="${topY}" x2="${cornerX}" y2="${bottomY}" stroke="#000000" stroke-width="2.0" />

            <line x1="${innerX}" y1="${innerY}" x2="${cornerX}" y2="${topY}" stroke="#000000" stroke-width="1.2" stroke-dasharray="6, 3" />

            ${createBreakLine(leftX, topY - 12, innerY + 12)}
            ${createBreakLine(innerX - 12, bottomY, cornerX + 12)}

            ${vanesSvg}

            <line x1="80" y1="${(topY + innerY)/2}" x2="190" y2="${(topY + innerY)/2}" stroke="#000000" stroke-width="1.8" marker-end="url(#arrowRight)" />
            <text x="135" y="${(topY + innerY)/2 - 12}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>
            <text x="135" y="${(topY + innerY)/2 + 18}" font-family="Arial, sans-serif" font-size="12" fill="#000000" text-anchor="middle">Aₒ</text>

            <line x1="${(innerX + cornerX)/2}" y1="210" x2="${(innerX + cornerX)/2}" y2="270" stroke="#000000" stroke-width="1.8" marker-end="url(#arrowRight)" />
            <text x="${(innerX + cornerX)/2}" y="240" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${dimLabel}</text>

            <g transform="translate(460, 70)">
                <text x="50" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">AIRFLOW</text>
                <line x1="10" y1="30" x2="90" y2="30" stroke="#000000" stroke-width="1.4" marker-end="url(#arrowRight)" />

                <path d="M 60 70 Q 95 80 110 130" fill="none" stroke="#000000" stroke-width="2.2" />
                <path d="M 20 110 Q 55 120 70 170" fill="none" stroke="#000000" stroke-width="2.2" />

                <line x1="50" y1="55" x2="10" y2="95" stroke="#000000" stroke-width="1.0" />
                <line x1="55" y1="60" x2="15" y2="100" stroke="#000000" stroke-width="1.0" marker-start="url(#arrowLeft)" marker-end="url(#arrowRight)" />
                <text x="40" y="75" font-family="Arial, sans-serif" font-size="12" font-style="italic" fill="#000000">s</text>

                <line x1="70" y1="170" x2="30" y2="170" stroke="#000000" stroke-width="1.0" />
                <line x1="30" y1="170" x2="30" y2="130" stroke="#000000" stroke-width="1.0" />
                <line x1="30" y1="170" x2="65" y2="145" stroke="#000000" stroke-width="1.2" marker-end="url(#arrowRight)" />
                <text x="15" y="185" font-family="Arial, sans-serif" font-size="12" font-style="italic" fill="#000000">r</text>
            </g>

            <text x="140" y="325" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000">r = 4.5 (110), s = 3.25 (80) in.(mm)</text>
        `;
    }

    // --- CAD Helper: Mitered Elbow with Double-Thickness Airfoil Vanes (CR3-15 Exact ASHRAE Match) ---
    function drawMiteredDoubleVanesElbow(group, d, qLabel, showVal, u) {
        const leftX = 140;
        const cornerX = 370;
        const topY = 70;
        const innerX = 250;
        const innerY = 190;
        const bottomY = 290;

        let dimLabel = "W × H";
        if (showVal) {
            const w = getInputVal("W", 300);
            const h = getInputVal("H", 300);
            dimLabel = u === "SI" ? `${w} × ${h}` : `${w}" × ${h}"`;
        }

        let vanesSvg = "";
        const numVanes = 6;
        for (let i = 1; i <= numVanes; i++) {
            const t = i / (numVanes + 1);
            const vx = innerX + t * (cornerX - innerX);
            const vy = innerY + t * (topY - innerY);
            vanesSvg += `
                <path d="M ${vx - 14} ${vy - 10} Q ${vx} ${vy - 4} ${vx + 14} ${vy + 10} Q ${vx - 4} ${vy + 2} ${vx - 14} ${vy - 10}" fill="#ffffff" stroke="#000000" stroke-width="1.6" />
            `;
        }

        group.innerHTML += `
            <line x1="${leftX}" y1="${topY}" x2="${cornerX}" y2="${topY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${leftX}" y1="${innerY}" x2="${innerX}" y2="${innerY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${innerX}" y1="${innerY}" x2="${innerX}" y2="${bottomY}" stroke="#000000" stroke-width="2.0" />
            <line x1="${cornerX}" y1="${topY}" x2="${cornerX}" y2="${bottomY}" stroke="#000000" stroke-width="2.0" />

            <line x1="${innerX}" y1="${innerY}" x2="${cornerX}" y2="${topY}" stroke="#000000" stroke-width="1.2" stroke-dasharray="6, 3" />

            ${createBreakLine(leftX, topY - 12, innerY + 12)}
            ${createBreakLine(innerX - 12, bottomY, cornerX + 12)}

            ${vanesSvg}

            <line x1="80" y1="${(topY + innerY)/2}" x2="190" y2="${(topY + innerY)/2}" stroke="#000000" stroke-width="1.8" marker-end="url(#arrowRight)" />
            <text x="135" y="${(topY + innerY)/2 - 12}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>
            <text x="135" y="${(topY + innerY)/2 + 18}" font-family="Arial, sans-serif" font-size="12" fill="#000000" text-anchor="middle">Aₒ</text>

            <line x1="${(innerX + cornerX)/2}" y1="210" x2="${(innerX + cornerX)/2}" y2="270" stroke="#000000" stroke-width="1.8" marker-end="url(#arrowRight)" />
            <text x="${(innerX + cornerX)/2}" y="240" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${dimLabel}</text>

            <g transform="translate(460, 70)">
                <text x="50" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">AIRFLOW</text>
                <line x1="10" y1="30" x2="90" y2="30" stroke="#000000" stroke-width="1.4" marker-end="url(#arrowRight)" />

                <path d="M 60 70 Q 100 80 115 130 Q 80 110 60 70" fill="none" stroke="#000000" stroke-width="1.8" />
                <path d="M 20 110 Q 60 120 75 170 Q 40 150 20 110" fill="none" stroke="#000000" stroke-width="1.8" />

                <line x1="50" y1="55" x2="10" y2="95" stroke="#000000" stroke-width="1.0" />
                <line x1="55" y1="60" x2="15" y2="100" stroke="#000000" stroke-width="1.0" marker-start="url(#arrowLeft)" marker-end="url(#arrowRight)" />
                <text x="40" y="75" font-family="Arial, sans-serif" font-size="12" font-style="italic" fill="#000000">s</text>

                <line x1="75" y1="170" x2="35" y2="170" stroke="#000000" stroke-width="1.0" />
                <line x1="35" y1="170" x2="35" y2="130" stroke="#000000" stroke-width="1.0" />
                <line x1="35" y1="170" x2="68" y2="145" stroke="#000000" stroke-width="1.2" marker-end="url(#arrowRight)" />
                <text x="15" y="185" font-family="Arial, sans-serif" font-size="12" font-style="italic" fill="#000000">r</text>
            </g>

            <text x="140" y="325" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000">r = 2.0 (50), s = 2.125 (60) in.(mm)</text>
        `;
    }

    // --- CAD Helper: Junction (Tee, Wye, Cross) ---
    function drawJunction(group, d, qLabel, showVal, u) {
        const mainLeft = 180;
        const mainRight = 540;
        const ductTop = 140;
        const ductBottom = 220;
        const centerY = (ductTop + ductBottom) / 2;
        const branchX = 360;
        const branchW = 70;

        group.innerHTML += `
            <!-- Main Run Bottom -->
            <line x1="${mainLeft}" y1="${ductBottom}" x2="${mainRight}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />
            <!-- Main Run Top with Branch Opening -->
            <line x1="${mainLeft}" y1="${ductTop}" x2="${branchX - branchW/2}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${branchX + branchW/2}" y1="${ductTop}" x2="${mainRight}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />

            <!-- Vertical Branch Duct -->
            <line x1="${branchX - branchW/2}" y1="${ductTop}" x2="${branchX - branchW/2}" y2="60" stroke="#000000" stroke-width="1.8" />
            <line x1="${branchX + branchW/2}" y1="${ductTop}" x2="${branchX + branchW/2}" y2="60" stroke="#000000" stroke-width="1.8" />
            ${createBreakLine(branchX - branchW/2 - 6, 60, branchX + branchW/2 + 6)}

            ${createBreakLine(mainLeft, ductTop - 10, ductBottom + 10)}
            ${createBreakLine(mainRight, ductTop - 10, ductBottom + 10)}

            <!-- Main Airflow Qc -->
            <line x1="140" y1="${centerY}" x2="250" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="180" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">Qc</text>

            <!-- Branch Airflow Qb -->
            <line x1="${branchX}" y1="130" x2="${branchX}" y2="40" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="${branchX + 22}" y="70" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">Qb</text>

            <!-- Main Downstream Qs -->
            <line x1="440" y1="${centerY}" x2="520" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="480" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">Qs</text>
        `;
    }

    // --- CAD Helper: Damper ---
    function drawDamper(group, d, qLabel, showVal, u) {
        const ductLeft = 210;
        const ductRight = 530;
        const ductTop = 110;
        const ductBottom = 210;
        const centerY = (ductTop + ductBottom) / 2;

        group.innerHTML += `
            <line x1="${ductLeft}" y1="${ductTop}" x2="${ductRight}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${ductLeft}" y1="${ductBottom}" x2="${ductRight}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />

            ${createBreakLine(ductLeft, ductTop - 12, ductBottom + 12)}
            ${createBreakLine(ductRight, ductTop - 12, ductBottom + 12)}

            <!-- Damper Frame Box -->
            <rect x="345" y="${ductTop - 4}" width="50" height="108" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="4, 2" />

            <!-- Opposed Damper Blades -->
            <line x1="370" y1="125" x2="385" y2="145" stroke="#000000" stroke-width="2.5" />
            <circle cx="370" cy="125" r="3" fill="#000000" />

            <line x1="370" y1="160" x2="355" y2="180" stroke="#000000" stroke-width="2.5" />
            <circle cx="370" cy="160" r="3" fill="#000000" />

            <line x1="370" y1="195" x2="385" y2="205" stroke="#000000" stroke-width="2.5" />
            <circle cx="370" cy="195" r="3" fill="#000000" />

            <line x1="160" y1="${centerY}" x2="280" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="210" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <text x="370" y="245" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">Damper (Open)</text>
        `;
    }

    // --- CAD Helper: General Technical Fitting ---
    function drawGeneralFitting(group, d, qLabel, showVal, u) {
        const ductLeft = 210;
        const ductRight = 530;
        const ductTop = 110;
        const ductBottom = 210;
        const centerY = (ductTop + ductBottom) / 2;

        group.innerHTML += `
            <line x1="${ductLeft}" y1="${ductTop}" x2="${ductRight}" y2="${ductTop}" stroke="#000000" stroke-width="1.8" />
            <line x1="${ductLeft}" y1="${ductBottom}" x2="${ductRight}" y2="${ductBottom}" stroke="#000000" stroke-width="1.8" />

            ${createBreakLine(ductLeft, ductTop - 12, ductBottom + 12)}
            ${createBreakLine(ductRight, ductTop - 12, ductBottom + 12)}

            <line x1="170" y1="${centerY}" x2="280" y2="${centerY}" stroke="#000000" stroke-width="1.6" marker-end="url(#arrowRight)" />
            <text x="220" y="${centerY - 10}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000" text-anchor="middle">${qLabel}</text>

            <text x="370" y="${centerY + 6}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle">${state.activeCode}</text>
        `;
    }

    // Helper: Mechanical Engineering Break Line
    function createBreakLine(x, y1, y2) {
        const midY = (y1 + y2) / 2;
        const zH = 12;
        const zW = 10;
        const pathData = `
            M ${x} ${y1}
            L ${x} ${midY - zH}
            L ${x + zW} ${midY - zH / 2}
            L ${x - zW} ${midY + zH / 2}
            L ${x} ${midY + zH}
            L ${x} ${y2}
        `;
        return `<path d="${pathData}" stroke="#000000" stroke-width="1.5" fill="none" />`;
    }

    // --- Fullscreen and CAD Workspace View Functions (User Request) ---
    function updateFsHud() {
        const u = state.unit;
        const d = state.activeData;
        const item = state.activeItem || {};
        const code = state.activeCode || "";

        if (elements.fsFittingName) {
            elements.fsFittingName.textContent = formatFittingTitle(item);
        }

        if (!elements.fsHudSummary) return;

        let qVal = getInputVal("Q", getInputVal("Qc", 2000));
        let qUnit = u === "SI" ? "L/s" : "cfm";
        let vVal = (elements.outV && elements.outV.textContent !== "-") ? elements.outV.textContent : getInputVal("V", "-");
        let vText = `${vVal} ${u === "SI" ? "m/s" : "fpm"}`;
        let pvText = (elements.outPv ? elements.outPv.textContent : "-") + (u === "SI" ? " Pa" : " in. wg");
        let fText = elements.outF ? elements.outF.textContent : "-";
        let dpText = (elements.outDp ? elements.outDp.textContent : "-") + (u === "SI" ? " Pa" : " in. wg");

        if (elements.fsHudQ) elements.fsHudQ.textContent = `${qVal} ${qUnit}`;
        if (elements.fsHudV) elements.fsHudV.textContent = vText;
        if (elements.fsHudPv) elements.fsHudPv.textContent = pvText;
        if (elements.fsHudF) elements.fsHudF.textContent = fText;
        if (elements.fsHudDp) elements.fsHudDp.textContent = dpText;
    }

    function toggleFullscreen(forceState) {
        const shouldBeFullscreen = (forceState !== undefined) ? forceState : !state.isFullscreen;
        state.isFullscreen = shouldBeFullscreen;

        if (state.isFullscreen) {
            elements.drawingWorkspace.classList.add("is-fullscreen");
            if (elements.checkFsShowValues) {
                elements.checkFsShowValues.checked = state.showValuesInDrawing;
            }
            updateFsHud();
            try {
                if (!document.fullscreenElement && elements.drawingWorkspace.requestFullscreen) {
                    elements.drawingWorkspace.requestFullscreen().catch(() => {});
                }
            } catch (err) {}
        } else {
            elements.drawingWorkspace.classList.remove("is-fullscreen");
            try {
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
            } catch (err) {}
            setCadZoom(1.0);
        }
    }

    function toggleCalcPanel() {
        state.isCalcCollapsed = !state.isCalcCollapsed;
        elements.mainContentPanel.classList.toggle("calc-panel-hidden", state.isCalcCollapsed);
        if (state.isCalcCollapsed) {
            elements.lblToggleCalc.textContent = "Restore Split View";
            elements.btnToggleCalcPanel.classList.add("cad-btn-primary");
        } else {
            elements.lblToggleCalc.textContent = "Maximize in Window";
            elements.btnToggleCalcPanel.classList.remove("cad-btn-primary");
        }
    }

    function setCadZoom(zoom) {
        state.cadZoom = Math.min(Math.max(zoom, 0.5), 2.5);
        elements.cadSheet.style.setProperty("--cad-zoom", state.cadZoom);
        if (elements.btnFsZoomReset) {
            elements.btnFsZoomReset.textContent = `${Math.round(state.cadZoom * 100)}%`;
        }
    }

    // --- Step-by-Step Engineering Calculation Breakdown Fullscreen Controller ---
    function updateCalcFsHeader() {
        if (!elements.calcFsTitleText) return;
        const isSizer = state.mode === "sizer" || (state.activeCode && state.activeCode.startsWith("SIZE-"));
        const code = isSizer ? "SIZE-AUTO" : (state.activeCode || "CR11-1");
        if (isSizer) {
            elements.calcFsTitleText.textContent = "Auto Duct Sizer";
            if (elements.calcFsCitationText) elements.calcFsCitationText.textContent = "ASHRAE Fundamentals, Ch. 21: Duct Design";
        } else {
            const item = state.activeItem || getFallbackItem(code);
            elements.calcFsTitleText.textContent = formatFittingTitle(item || {code});
            if (elements.calcFsCitationText) {
                const cit = item?.citation || "(ASHRAE Fundamentals, Ch. 21)";
                elements.calcFsCitationText.textContent = cit.startsWith("(") ? cit : `(${cit})`;
            }
        }
    }

    function applyCalcFsZoom(zoom) {
        state.calcFsZoom = Math.min(Math.max(zoom, 0.6), 2.2);
        if (elements.formulasContainer) {
            elements.formulasContainer.style.zoom = state.calcFsZoom;
        }
        if (elements.btnCalcFsZoomReset) {
            elements.btnCalcFsZoomReset.textContent = `${Math.round(state.calcFsZoom * 100)}%`;
        }
    }

    function toggleCalcFullscreen(forceState) {
        const shouldBeFullscreen = (forceState !== undefined) ? forceState : !state.isCalcFullscreen;
        state.isCalcFullscreen = shouldBeFullscreen;

        if (state.isCalcFullscreen) {
            // Exit CAD workspace fullscreen if open
            if (state.isFullscreen) {
                toggleFullscreen(false);
            }
            if (elements.formulasWrapper) {
                elements.formulasWrapper.classList.add("is-fullscreen");
            }
            if (elements.formulasContainer) {
                elements.formulasContainer.classList.remove("hidden");
            }
            if (elements.fToggleArrow) {
                elements.fToggleArrow.classList.remove("collapsed");
            }
            if (elements.calcFsTopBar) {
                elements.calcFsTopBar.classList.remove("hidden");
            }
            updateCalcFsHeader();
            applyCalcFsZoom(1.0);

            try {
                if (!document.fullscreenElement && elements.formulasWrapper && elements.formulasWrapper.requestFullscreen) {
                    elements.formulasWrapper.requestFullscreen().catch(() => {});
                }
            } catch (err) {}
        } else {
            if (elements.formulasWrapper) {
                elements.formulasWrapper.classList.remove("is-fullscreen");
            }
            if (elements.calcFsTopBar) {
                elements.calcFsTopBar.classList.add("hidden");
            }
            applyCalcFsZoom(1.0);
            try {
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
            } catch (err) {}
        }
    }

    // --- Event Listeners Setup ---
    function setupGlobalListeners() {
        // Calculate Button
        elements.btnCalculate.addEventListener("click", calculate);

        // Download Calculation PDF Button (Action Row)
        if (elements.btnDownloadCalcAction) {
            elements.btnDownloadCalcAction.addEventListener("click", downloadCurrentCalculationPdf);
        }

        if (elements.btnResetSizer) {
            elements.btnResetSizer.addEventListener("click", () => {
                if (state.mode === "sizer") {
                    state.userSizerValues = {};
                    clearSizerOutputs();
                    updateHeaderAndInputs();
                } else {
                    state.userRoughnessValue = null;
                    elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                        inp.value = "";
                    });
                    clearFittingOutputs();
                }

                state.targetHf = null;
                state.targetV = null;
                state.lastConstraint = null;
                state.lastChanged = null;
                state.selectedRoughnessMaterial = null;
                state.activeRoughnessIndex = -1;

                const matBadge = document.getElementById("lblRoughnessMatName") || document.querySelector(".roughness-mat-badge");
                if (matBadge) {
                    matBadge.textContent = "Select Material (Optional)";
                }

                if (elements.sizeTargetVal) elements.sizeTargetVal.value = "";
                if (elements.sizeFixedDim) elements.sizeFixedDim.value = "";

                renderCadDrawing();
                const qEl = document.getElementById("input-H") || document.getElementById("input-Q") || elements.inputTableBody.querySelector("input");
                if (qEl) qEl.focus();
            });
        }

        // Air Condition Dropdown Switcher (McQuay Parity)
        if (elements.selectAirCondition) {
            elements.selectAirCondition.addEventListener("change", (e) => {
                state.selectedAirConditionId = e.target.value;
                updateAirConditionUI();
                solveDuctSizer("target_hf");
                calculate();
            });
        }

        // Unit Switches
        elements.btnUnitSI.addEventListener("click", () => setUnit("SI"));
        elements.btnUnitIP.addEventListener("click", () => setUnit("IP"));

        // Mode Switches
        elements.btnModeDirect.addEventListener("click", () => setMode("direct"));
        elements.btnModeSizer.addEventListener("click", () => setMode("sizer"));

        // Sizer Shape Nav Pills (Attached to Auto Duct Sizer Button)
        if (elements.btnNavRect) {
            elements.btnNavRect.addEventListener("click", (e) => {
                e.stopPropagation();
                switchSizerShape("rect");
            });
        }
        if (elements.btnNavRound) {
            elements.btnNavRound.addEventListener("click", (e) => {
                e.stopPropagation();
                switchSizerShape("round");
            });
        }

        // Dedicated Sizer Shape Header Bar
        if (elements.btnHeaderRect) {
            elements.btnHeaderRect.addEventListener("click", () => switchSizerShape("rect"));
        }
        if (elements.btnHeaderRound) {
            elements.btnHeaderRound.addEventListener("click", () => switchSizerShape("round"));
        }

        // Reset Baseline (if button present)
        if (elements.btnResetDefault) {
            elements.btnResetDefault.addEventListener("click", resetToScreenshotDefault);
        }

        // Tree Search
        if (elements.btnClearTreeSearch) {
            elements.btnClearTreeSearch.addEventListener("click", () => {
                if (elements.treeSearchInput) {
                    elements.treeSearchInput.value = "";
                    filterTree("");
                    elements.treeSearchInput.focus();
                }
            });
        }

        if (elements.treeSearchInput) {
            elements.treeSearchInput.addEventListener("input", (e) => filterTree(e.target.value));
            elements.treeSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    selectFittingFromSearch(elements.treeSearchInput.value);
                } else if (e.key === "Escape") {
                    elements.treeSearchInput.value = "";
                    filterTree("");
                    elements.treeSearchInput.blur();
                }
            });
        }

        // Expand / Collapse All
        elements.btnExpandAll.addEventListener("click", () => toggleAllFolders(true));
        elements.btnCollapseAll.addEventListener("click", () => toggleAllFolders(false));

        // DuctFit Pro Fitting Catalog Area Enlarge & Resizer Logic
        initCatalogEnlargeControls();

        // Sizing Controls (Safe checks if banner is present)
        if (elements.sizeTargetType) {
            elements.sizeTargetType.addEventListener("change", (e) => {
                state.sizeTargetType = e.target.value;
                if (elements.lblTargetVal && elements.sizeTargetVal) {
                    if (state.sizeTargetType === "friction") {
                        elements.lblTargetVal.textContent = state.unit === "SI" ? "Target Loss (Pa/m):" : "Target Loss (in/100ft):";
                        elements.sizeTargetVal.value = state.unit === "SI" ? "1.0" : "0.10";
                    } else {
                        elements.lblTargetVal.textContent = state.unit === "SI" ? "Target Vel (m/s):" : "Target Vel (fpm):";
                        elements.sizeTargetVal.value = state.unit === "SI" ? "6.0" : "1200";
                    }
                }
                calculate();
            });
        }

        if (elements.sizeFixedType) {
            elements.sizeFixedType.addEventListener("change", (e) => {
                state.sizeFixedType = e.target.value;
                if (elements.lblFixedDim && elements.sizeFixedDim) {
                    if (state.sizeFixedType === "AR") {
                        elements.lblFixedDim.textContent = "Aspect Ratio (W/H):";
                        elements.sizeFixedDim.value = "1.5";
                    } else if (state.sizeFixedType === "W") {
                        elements.lblFixedDim.textContent = state.unit === "SI" ? "Width (mm):" : "Width (in):";
                        elements.sizeFixedDim.value = state.unit === "SI" ? "300" : "12";
                    } else {
                        elements.lblFixedDim.textContent = state.unit === "SI" ? "Height (mm):" : "Height (in):";
                        elements.sizeFixedDim.value = state.unit === "SI" ? "300" : "12";
                    }
                }
                calculate();
            });
        }

        if (elements.sizeTargetVal) {
            elements.sizeTargetVal.addEventListener("input", debounceCalculate);
        }
        if (elements.sizeFixedDim) {
            elements.sizeFixedDim.addEventListener("input", debounceCalculate);
        }

        // Fullscreen and Workspace Zoom Actions
        if (elements.btnToggleDiagramMode) {
            elements.btnToggleDiagramMode.addEventListener("click", () => {
                state.diagramMode = (state.diagramMode === "official") ? "svg" : "official";
                renderCadDrawing();
            });
        }
        if (elements.btnFullscreenView) {
            elements.btnFullscreenView.addEventListener("click", () => toggleFullscreen(true));
        }
        if (elements.btnExitFullscreen) {
            elements.btnExitFullscreen.addEventListener("click", () => toggleFullscreen(false));
        }
        if (elements.btnToggleCalcPanel) {
            elements.btnToggleCalcPanel.addEventListener("click", toggleCalcPanel);
        }
        if (elements.btnFsZoomIn) {
            elements.btnFsZoomIn.addEventListener("click", () => setCadZoom(state.cadZoom + 0.2));
        }
        if (elements.btnFsZoomOut) {
            elements.btnFsZoomOut.addEventListener("click", () => setCadZoom(state.cadZoom - 0.2));
        }
        if (elements.btnFsZoomReset) {
            elements.btnFsZoomReset.addEventListener("click", () => setCadZoom(1.0));
        }
        if (elements.btnFsPrint) {
            elements.btnFsPrint.addEventListener("click", () => window.print());
        }

        // Fullscreen Synchronized Values Toggle
        if (elements.checkFsShowValues) {
            elements.checkFsShowValues.addEventListener("change", (e) => {
                state.showValuesInDrawing = e.target.checked;
                elements.checkShowValues.checked = e.target.checked;
                renderCadDrawing();
            });
        }

        // Toggle Values in CAD Drawing
        elements.checkShowValues.addEventListener("change", (e) => {
            state.showValuesInDrawing = e.target.checked;
            if (elements.checkFsShowValues) {
                elements.checkFsShowValues.checked = e.target.checked;
            }
            renderCadDrawing();
        });

        // Toggle Formulas Panel Visibility (Collapsed by default)
        elements.formulasToggleHeader.addEventListener("click", (e) => {
            if (e.target.closest("#btnCalcFullscreen") || e.target.closest(".btn-calc-fullscreen")) {
                return;
            }
            const isCurrentlyHidden = elements.formulasContainer.classList.contains("hidden") || elements.formulasContainer.style.display === "none";
            if (isCurrentlyHidden) {
                elements.formulasContainer.classList.remove("hidden");
                elements.formulasContainer.style.display = "block";
                if (elements.fToggleArrow) elements.fToggleArrow.textContent = "▼";
            } else {
                elements.formulasContainer.classList.add("hidden");
                elements.formulasContainer.style.display = "none";
                if (elements.fToggleArrow) elements.fToggleArrow.textContent = "▶";
            }
        });

        // Calculation Breakdown Fullscreen Toolbar Buttons
        if (elements.btnCalcFullscreen) {
            elements.btnCalcFullscreen.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleCalcFullscreen(true);
            });
        }
        if (elements.btnExitCalcFullscreen) {
            elements.btnExitCalcFullscreen.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleCalcFullscreen(false);
            });
        }
        if (elements.btnCalcFsZoomIn) {
            elements.btnCalcFsZoomIn.addEventListener("click", () => applyCalcFsZoom(state.calcFsZoom + 0.15));
        }
        if (elements.btnCalcFsZoomOut) {
            elements.btnCalcFsZoomOut.addEventListener("click", () => applyCalcFsZoom(state.calcFsZoom - 0.15));
        }
        if (elements.btnCalcFsZoomReset) {
            elements.btnCalcFsZoomReset.addEventListener("click", () => applyCalcFsZoom(1.0));
        }
        if (elements.btnCalcFsDownloadPdf) {
            elements.btnCalcFsDownloadPdf.addEventListener("click", (e) => {
                downloadCurrentCalculationPdf(e);
            });
        }

        // Hover tracking for context-aware shortcut keys
        let isHoveringCalc = false;
        if (elements.formulasWrapper) {
            elements.formulasWrapper.addEventListener("mouseenter", () => { isHoveringCalc = true; });
            elements.formulasWrapper.addEventListener("mouseleave", () => { isHoveringCalc = false; });
        }

        // ASHRAE Duct Fitting Code Guide Modal Handlers
        if (elements.btnFittingCodeGuide) {
            elements.btnFittingCodeGuide.addEventListener("click", () => openFittingCodeModal());
        }
        if (elements.btnCloseCodeModal) {
            elements.btnCloseCodeModal.addEventListener("click", closeFittingCodeModal);
        }
        if (elements.btnCloseCodeModalBottom) {
            elements.btnCloseCodeModalBottom.addEventListener("click", closeFittingCodeModal);
        }
        if (elements.fittingCodeModal) {
            elements.fittingCodeModal.addEventListener("click", (e) => {
                if (e.target === elements.fittingCodeModal) {
                    closeFittingCodeModal();
                }
            });
        }
        if (elements.codeDecoderInput) {
            elements.codeDecoderInput.addEventListener("input", (e) => {
                updateCodeDecoderView(e.target.value);
            });
        }
        if (elements.btnDecodeCurrent) {
            elements.btnDecodeCurrent.addEventListener("click", () => {
                const code = state.activeCode || "CR3-1";
                if (elements.codeDecoderInput) elements.codeDecoderInput.value = code;
                updateCodeDecoderView(code);
            });
        }
        // Click on Example Tiles in Modal
        document.querySelectorAll(".ex-tile").forEach(tile => {
            tile.addEventListener("click", () => {
                const code = tile.dataset.code;
                if (code && elements.codeDecoderInput) {
                    elements.codeDecoderInput.value = code;
                    updateCodeDecoderView(code);
                }
            });
        });

        // Click on Table 5 Code Items to interactively build & decode code
        document.querySelectorAll(".ashrae-table5 .code-item").forEach(item => {
            item.addEventListener("click", () => {
                const char = item.dataset.decode;
                if (!char || !elements.codeDecoderInput) return;
                let cur = elements.codeDecoderInput.value.trim().toUpperCase();
                if (/^\d+$/.test(char)) {
                    if (cur.length >= 2) {
                        cur = cur.slice(0, 2) + char + "-1";
                    } else {
                        cur = "CR" + char + "-1";
                    }
                } else if (["S", "E", "C"].includes(char)) {
                    if (cur.length >= 1) {
                        cur = char + cur.slice(1);
                    } else {
                        cur = char + "R3-1";
                    }
                } else if (["D", "R", "F"].includes(char)) {
                    if (cur.length >= 2) {
                        cur = cur[0] + char + cur.slice(2);
                    } else if (cur.length === 1) {
                        cur = cur[0] + char + "3-1";
                    } else {
                        cur = "C" + char + "3-1";
                    }
                }
                elements.codeDecoderInput.value = cur;
                updateCodeDecoderView(cur);
            });
        });

        // ASHRAE Absolute Roughness Material Picker Modal Handlers
        if (elements.btnSelectRoughness) {
            elements.btnSelectRoughness.addEventListener("click", applySelectedRoughness);
        }
        if (elements.btnCancelRoughness) {
            elements.btnCancelRoughness.addEventListener("click", closeRoughnessModal);
        }
        if (elements.btnCloseRoughnessModal) {
            elements.btnCloseRoughnessModal.addEventListener("click", closeRoughnessModal);
        }
        if (elements.roughnessModalBackdrop) {
            elements.roughnessModalBackdrop.addEventListener("click", (e) => {
                if (e.target === elements.roughnessModalBackdrop) {
                    closeRoughnessModal();
                }
            });
        }
        if (elements.roughnessListContainer) {
            elements.roughnessListContainer.addEventListener("keydown", (e) => {
                if (!elements.roughnessModalBackdrop.classList.contains("open")) return;
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    selectRoughnessIndex(Math.min(ASHRAE_ROUGHNESS_MATERIALS.length - 1, state.activeRoughnessIndex + 1));
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    selectRoughnessIndex(Math.max(0, state.activeRoughnessIndex - 1));
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    applySelectedRoughness();
                }
            });
        }

        // Global Keyboard Shortcuts (F / C / Shift+F for Fullscreen, Esc to Exit, +/- for Zoom)
        document.addEventListener("keydown", (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";

            if (e.key === "Escape") {
                if (state.isCalcFullscreen) {
                    toggleCalcFullscreen(false);
                    e.preventDefault();
                    return;
                }
                if (elements.roughnessModalBackdrop && elements.roughnessModalBackdrop.classList.contains("open")) {
                    closeRoughnessModal();
                    return;
                }
                if (elements.fittingCodeModal && !elements.fittingCodeModal.classList.contains("hidden")) {
                    closeFittingCodeModal();
                    return;
                }
                if (state.isFullscreen) {
                    toggleFullscreen(false);
                    return;
                }
            }

            if (tag === "input" || tag === "textarea" || tag === "select") {
                return;
            }

            // Calculation Full Screen Shortcut: C key or Shift+F
            if (e.key === "c" || e.key === "C" || (e.shiftKey && (e.key === "f" || e.key === "F"))) {
                toggleCalcFullscreen();
                e.preventDefault();
                return;
            }

            // F key: Context-aware Fullscreen toggle
            if (e.key === "f" || e.key === "F") {
                if (state.isCalcFullscreen) {
                    toggleCalcFullscreen(false);
                } else if (isHoveringCalc) {
                    toggleCalcFullscreen(true);
                } else {
                    toggleFullscreen();
                }
                e.preventDefault();
                return;
            }

            // Zoom In / Out / Reset
            if (state.isCalcFullscreen) {
                if (e.key === "+" || e.key === "=") {
                    applyCalcFsZoom(state.calcFsZoom + 0.15);
                    e.preventDefault();
                } else if (e.key === "-" || e.key === "_") {
                    applyCalcFsZoom(state.calcFsZoom - 0.15);
                    e.preventDefault();
                } else if (e.key === "0") {
                    applyCalcFsZoom(1.0);
                    e.preventDefault();
                }
            } else if (state.isFullscreen) {
                if (e.key === "+" || e.key === "=") {
                    setCadZoom(state.cadZoom + 0.15);
                    e.preventDefault();
                } else if (e.key === "-" || e.key === "_") {
                    setCadZoom(state.cadZoom - 0.15);
                    e.preventDefault();
                } else if (e.key === "0") {
                    setCadZoom(1.0);
                    e.preventDefault();
                }
            }
        });

        // Sync with browser native fullscreen exit
        document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement) {
                if (state.isCalcFullscreen) {
                    toggleCalcFullscreen(false);
                }
                if (state.isFullscreen) {
                    toggleFullscreen(false);
                }
            }
        });
    }


    // =========================================================================
    // PROJECT MANAGEMENT & FITTING SCHEDULE (ASHRAE DATABASE MODEL)
    // =========================================================================

    async function initProjectManager() {
        try {
            const resp = await fetch("/api/projects");
            const res = await resp.json();
            if (res.status === "success") {
                state.projects = res.data.projects || [];
                state.activeProjectId = res.data.active_project_id;
                renderProjectDropdown();
                if (state.activeProjectId) {
                    await fetchActiveProjectDetails(state.activeProjectId);
                }
            }
        } catch (err) {
            console.error("Failed to load projects:", err);
        }
    }

    function renderProjectDropdown() {
        if (elements.selectActiveProject) {
            elements.selectActiveProject.innerHTML = "";
        }
        if (!state.projects || state.projects.length === 0) {
            if (elements.selectActiveProject) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "-- No Projects (Create One) --";
                elements.selectActiveProject.appendChild(opt);
            }
            if (elements.prjComboSelectedText) {
                elements.prjComboSelectedText.textContent = "-- No Projects (Create One) --";
            }
            updateProjectRibbonSnippet(null);
            renderPrjComboList("");
            return;
        }

        state.projects.forEach(p => {
            if (elements.selectActiveProject) {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = `${p.code} - ${p.name}`;
                if (p.id === state.activeProjectId) {
                    opt.selected = true;
                }
                elements.selectActiveProject.appendChild(opt);
            }
        });

        const cur = state.projects.find(p => p.id === state.activeProjectId) || state.projects[0];
        if (cur && cur.id !== state.activeProjectId) {
            state.activeProjectId = cur.id;
        }
        if (cur && elements.prjComboSelectedText) {
            elements.prjComboSelectedText.textContent = `${cur.code} - ${cur.name}`;
        }
        updateProjectRibbonSnippet(cur);
        renderPrjComboList(elements.prjComboSearchInput ? elements.prjComboSearchInput.value : "");
    }

    function renderPrjComboList(filterText = "") {
        if (!elements.prjComboList) return;
        elements.prjComboList.innerHTML = "";

        const q = (filterText || "").trim().toLowerCase();
        const filtered = (!q) ? state.projects : state.projects.filter(p => {
            const code = (p.code || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            const client = (p.client || "").toLowerCase();
            const contractor = (p.contractor || "").toLowerCase();
            const notes = (p.notes || "").toLowerCase();
            return code.includes(q) || name.includes(q) || client.includes(q) || contractor.includes(q) || notes.includes(q);
        });

        if (elements.btnClearComboSearch) {
            elements.btnClearComboSearch.classList.toggle("hidden", !q);
        }

        if (filtered.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "prj-combo-empty";
            emptyDiv.textContent = q ? `No projects matching "${filterText}"` : "No projects saved yet";
            elements.prjComboList.appendChild(emptyDiv);
            return;
        }

        filtered.forEach(p => {
            const item = document.createElement("div");
            item.className = "prj-combo-item" + (p.id === state.activeProjectId ? " active" : "");
            item.setAttribute("data-project-id", p.id);
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", p.id === state.activeProjectId ? "true" : "false");

            const fitCount = p.fittings_count !== undefined ? p.fittings_count : (p.fittings ? p.fittings.length : 0);
            const segCount = p.duct_segments_count !== undefined ? p.duct_segments_count : (p.duct_segments ? p.duct_segments.length : 0);
            const clientText = p.client ? `Client: ${escapeHtml(p.client)}` : (p.contractor ? `Contr: ${escapeHtml(p.contractor)}` : "Standard Project");

            item.innerHTML = `
                <div class="prj-item-top">
                    <span class="prj-item-code">${escapeHtml(p.code)}</span>
                    <span class="prj-item-name">${escapeHtml(p.name)}</span>
                    ${p.id === state.activeProjectId ? '<span class="prj-active-badge">Active</span>' : ''}
                </div>
                <div class="prj-item-bottom">
                    <span class="prj-item-client">${clientText}</span>
                    <span class="prj-item-counts">${fitCount} fittings • ${segCount} sized runs</span>
                </div>
            `;

            item.addEventListener("click", () => {
                closePrjComboDropdown();
                switchActiveProject(p.id);
            });

            elements.prjComboList.appendChild(item);
        });
    }

    function togglePrjComboDropdown(forceOpen) {
        if (!elements.prjComboDropdown) return;
        const willOpen = (typeof forceOpen === "boolean") ? forceOpen : elements.prjComboDropdown.classList.contains("hidden");
        if (willOpen) {
            elements.prjComboDropdown.classList.remove("hidden");
            if (elements.prjComboSearchInput) {
                elements.prjComboSearchInput.value = "";
                renderPrjComboList("");
                setTimeout(() => elements.prjComboSearchInput.focus(), 50);
            }
        } else {
            closePrjComboDropdown();
        }
    }

    function closePrjComboDropdown() {
        if (elements.prjComboDropdown) {
            elements.prjComboDropdown.classList.add("hidden");
        }
    }

    async function fetchActiveProjectDetails(projectId) {
        if (!projectId) return;
        try {
            const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
            const res = await resp.json();
            if (res.status === "success") {
                state.activeProject = res.data;
                state.activeProjectId = res.data.id;
                updateProjectRibbonSnippet(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch project details:", err);
        }
    }

    function updateProjectRibbonSnippet(proj) {
        if (!proj) {
            if (elements.snippetPrjCode) elements.snippetPrjCode.textContent = "No Project Selected";
            if (elements.snippetPrjClient) elements.snippetPrjClient.textContent = "Click '+ Add New Project'";
            if (elements.badgeProjectFittingCount) elements.badgeProjectFittingCount.textContent = "0";
            return;
        }
        if (elements.snippetPrjCode) elements.snippetPrjCode.textContent = proj.code || proj.id;
        if (elements.snippetPrjClient) {
            const clientText = proj.client ? `Client: ${proj.client}` : (proj.contractor ? `Contr: ${proj.contractor}` : "Active Project");
            elements.snippetPrjClient.textContent = clientText;
        }
        updateProjectRibbonBadge();
    }

    function updateProjectRibbonBadge() {
        if (!elements.badgeProjectFittingCount) return;
        const proj = state.activeProject;
        if (!proj) {
            elements.badgeProjectFittingCount.textContent = "0";
            return;
        }
        if (state.mode === "sizer") {
            const segs = proj.duct_segments || [];
            elements.badgeProjectFittingCount.textContent = String(segs.length);
            elements.badgeProjectFittingCount.title = `${segs.length} sized duct runs in schedule`;
        } else {
            const fits = proj.fittings || [];
            elements.badgeProjectFittingCount.textContent = String(fits.length);
            elements.badgeProjectFittingCount.title = `${fits.length} duct fittings in schedule`;
        }
    }

    async function switchActiveProject(projectId) {
        if (!projectId) return;
        try {
            const resp = await fetch("/api/projects/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: projectId })
            });
            const res = await resp.json();
            if (res.status === "success") {
                state.activeProjectId = projectId;
                await fetchActiveProjectDetails(projectId);
                renderProjectDropdown();
                if (elements.allProjectsModal && !elements.allProjectsModal.classList.contains("hidden")) {
                    renderAllProjectsTable(elements.inputFilterAllProjects ? elements.inputFilterAllProjects.value : "");
                }
                showPrjToast(`📁 Active Project switched to: ${state.activeProject ? state.activeProject.name : projectId}`);
            }
        } catch (err) {
            console.error("Failed to select project:", err);
        }
    }

    // --- All Projects Management (View, Search, Edit, Delete) ---

    function openAllProjectsModal() {
        if (!elements.allProjectsModal) return;
        if (elements.inputFilterAllProjects) {
            elements.inputFilterAllProjects.value = "";
        }
        renderAllProjectsTable("");
        elements.allProjectsModal.classList.remove("hidden");
        if (elements.inputFilterAllProjects) {
            setTimeout(() => elements.inputFilterAllProjects.focus(), 100);
        }
    }

    function closeAllProjectsModal() {
        if (elements.allProjectsModal) {
            elements.allProjectsModal.classList.add("hidden");
        }
    }

    function renderAllProjectsTable(filterText = "") {
        if (!elements.tbodyAllProjects) return;
        elements.tbodyAllProjects.innerHTML = "";

        const q = (filterText || "").trim().toLowerCase();
        const filtered = (!q) ? state.projects : state.projects.filter(p => {
            const code = (p.code || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            const client = (p.client || "").toLowerCase();
            const contractor = (p.contractor || "").toLowerCase();
            const sub = (p.subcontractor || "").toLowerCase();
            const notes = (p.notes || "").toLowerCase();
            return code.includes(q) || name.includes(q) || client.includes(q) || contractor.includes(q) || sub.includes(q) || notes.includes(q);
        });

        if (elements.btnClearFilterAllProjects) {
            elements.btnClearFilterAllProjects.classList.toggle("hidden", !q);
        }
        if (elements.allProjectsCount) {
            elements.allProjectsCount.textContent = String(filtered.length);
        }

        if (filtered.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td colspan="10" style="text-align: center; padding: 24px; color: #64748b; font-style: italic;">
                    ${q ? `No projects matching "${escapeHtml(filterText)}"` : "No projects registered in the system yet. Click '+ Add New Project' to create one."}
                </td>
            `;
            elements.tbodyAllProjects.appendChild(tr);
            return;
        }

        filtered.forEach((p, idx) => {
            const tr = document.createElement("tr");
            const isActive = (p.id === state.activeProjectId);
            if (isActive) {
                tr.style.backgroundColor = "#f0fdf4";
            }

            const fitCount = p.fittings_count !== undefined ? p.fittings_count : (p.fittings ? p.fittings.length : 0);
            const segCount = p.duct_segments_count !== undefined ? p.duct_segments_count : (p.duct_segments ? p.duct_segments.length : 0);
            const modDate = p.updated_at ? formatAppDate(p.updated_at) : (p.created_at ? formatAppDate(p.created_at) : "-");

            tr.innerHTML = `
                <td class="text-center num-cell">${idx + 1}</td>
                <td class="text-center">
                    ${isActive
                        ? '<span class="status-badge active" title="Currently selected project">✓ Active</span>'
                        : `<button type="button" class="btn-set-active btn-make-active" data-prj-id="${p.id}" title="Make this the current active project">🎯 Select</button>`}
                </td>
                <td><span class="code-pill">${escapeHtml(p.code)}</span></td>
                <td>
                    <div style="font-weight: 700; color: #0f172a;">${escapeHtml(p.name)}</div>
                    ${p.notes ? `<div style="font-size: 10.5px; color: #64748b;">${escapeHtml(p.notes)}</div>` : ''}
                </td>
                <td>${escapeHtml(p.client || "-")}</td>
                <td>${escapeHtml(p.contractor || "-")}</td>
                <td class="text-center num-cell">${segCount}</td>
                <td class="text-center num-cell">${fitCount}</td>
                <td style="font-size: 11px; color: #64748b;">${escapeHtml(modDate)}</td>
                <td class="text-center">
                    <div style="display: inline-flex; gap: 6px;">
                        <button type="button" class="btn-table-action edit-prj btn-edit-prj" data-prj-id="${p.id}" title="Edit project specifications">✏️ Edit</button>
                        <button type="button" class="btn-table-action delete btn-del-prj" data-prj-id="${p.id}" title="Permanently delete project">🗑️ Delete</button>
                    </div>
                </td>
            `;

            // Wire row buttons
            const btnSelect = tr.querySelector(".btn-make-active");
            if (btnSelect) {
                btnSelect.addEventListener("click", () => {
                    switchActiveProject(p.id);
                });
            }

            const btnEdit = tr.querySelector(".btn-edit-prj");
            if (btnEdit) {
                btnEdit.addEventListener("click", () => openEditProjectModal(p.id));
            }

            const btnDel = tr.querySelector(".btn-del-prj");
            if (btnDel) {
                btnDel.addEventListener("click", () => confirmDeleteProject(p.id));
            }

            elements.tbodyAllProjects.appendChild(tr);
        });
    }

    function openEditProjectModal(projectId) {
        if (!elements.editProjectModal) return;
        const proj = state.projects.find(p => p.id === projectId);
        if (!proj) return;

        if (elements.editPrjId) elements.editPrjId.value = proj.id;
        if (elements.inputEditPrjCode) elements.inputEditPrjCode.value = proj.code || proj.id;
        if (elements.inputEditPrjName) elements.inputEditPrjName.value = proj.name || "";
        if (elements.inputEditPrjClient) elements.inputEditPrjClient.value = proj.client || "";
        if (elements.inputEditPrjContractor) elements.inputEditPrjContractor.value = proj.contractor || "";
        if (elements.inputEditPrjSubcontractor) elements.inputEditPrjSubcontractor.value = proj.subcontractor || "";
        if (elements.inputEditPrjNotes) elements.inputEditPrjNotes.value = proj.notes || "";

        elements.editProjectModal.classList.remove("hidden");
        if (elements.inputEditPrjName) {
            setTimeout(() => elements.inputEditPrjName.focus(), 100);
        }
    }

    function closeEditProjectModal() {
        if (elements.editProjectModal) {
            elements.editProjectModal.classList.add("hidden");
        }
    }

    async function saveEditProject() {
        const pid = elements.editPrjId ? elements.editPrjId.value : "";
        if (!pid) return;

        const code = (elements.inputEditPrjCode ? elements.inputEditPrjCode.value.trim() : "");
        const name = (elements.inputEditPrjName ? elements.inputEditPrjName.value.trim() : "");
        const client = (elements.inputEditPrjClient ? elements.inputEditPrjClient.value.trim() : "");
        const contractor = (elements.inputEditPrjContractor ? elements.inputEditPrjContractor.value.trim() : "");
        const subcontractor = (elements.inputEditPrjSubcontractor ? elements.inputEditPrjSubcontractor.value.trim() : "");
        const notes = (elements.inputEditPrjNotes ? elements.inputEditPrjNotes.value.trim() : "");

        if (!code || !name) {
            alert("Project Code and Project Name are required.");
            if (!code && elements.inputEditPrjCode) elements.inputEditPrjCode.focus();
            else if (!name && elements.inputEditPrjName) elements.inputEditPrjName.focus();
            return;
        }

        try {
            const resp = await fetch(`/api/projects/${encodeURIComponent(pid)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: code,
                    name: name,
                    client: client,
                    contractor: contractor,
                    subcontractor: subcontractor,
                    notes: notes
                })
            });
            const res = await resp.json();
            if (res.status === "success") {
                closeEditProjectModal();
                showPrjToast(`✓ Project "${code} - ${name}" updated successfully!`);
                await initProjectManager();
                if (elements.allProjectsModal && !elements.allProjectsModal.classList.contains("hidden")) {
                    renderAllProjectsTable(elements.inputFilterAllProjects ? elements.inputFilterAllProjects.value : "");
                }
            } else {
                alert(`Error: ${res.message || "Failed to update project"}`);
            }
        } catch (err) {
            console.error("Failed to update project:", err);
            alert("Network error updating project.");
        }
    }

    async function confirmDeleteProject(projectId) {
        if (!projectId) return;
        const proj = state.projects.find(p => p.id === projectId);
        const nameStr = proj ? `"${proj.code} - ${proj.name}"` : `project [${projectId}]`;

        const fits = proj && proj.fittings_count !== undefined ? proj.fittings_count : 0;
        const segs = proj && proj.duct_segments_count !== undefined ? proj.duct_segments_count : 0;
        const extraMsg = (fits > 0 || segs > 0) ? `\n\nWarning: This project contains ${fits} fitting(s) and ${segs} sized duct run(s) which will also be permanently deleted.` : "";

        if (!confirm(`Are you sure you want to permanently delete ${nameStr}?${extraMsg}\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
                method: "DELETE"
            });
            const res = await resp.json();
            if (res.status === "success") {
                showPrjToast(`🗑️ Project ${nameStr} was deleted.`);
                await initProjectManager();
                if (elements.allProjectsModal && !elements.allProjectsModal.classList.contains("hidden")) {
                    renderAllProjectsTable(elements.inputFilterAllProjects ? elements.inputFilterAllProjects.value : "");
                }
            } else {
                alert(`Error: ${res.message || "Failed to delete project"}`);
            }
        } catch (err) {
            console.error("Failed to delete project:", err);
            alert("Network error deleting project.");
        }
    }

    function openNewProjectModal() {
        if (!elements.newProjectModal) return;
        if (elements.inputPrjCode) {
            elements.inputPrjCode.value = "";
            setTimeout(() => elements.inputPrjCode.focus(), 150);
        }
        if (elements.inputPrjName) elements.inputPrjName.value = "";
        if (elements.inputPrjClient) elements.inputPrjClient.value = "";
        if (elements.inputPrjContractor) elements.inputPrjContractor.value = "";
        if (elements.inputPrjSubcontractor) elements.inputPrjSubcontractor.value = "";
        if (elements.inputPrjNotes) elements.inputPrjNotes.value = "";

        elements.newProjectModal.classList.remove("hidden");
    }

    function closeNewProjectModal() {
        if (elements.newProjectModal) {
            elements.newProjectModal.classList.add("hidden");
        }
    }

    async function saveNewProject() {
        const code = (elements.inputPrjCode ? elements.inputPrjCode.value.trim() : "");
        const name = (elements.inputPrjName ? elements.inputPrjName.value.trim() : "");
        const client = (elements.inputPrjClient ? elements.inputPrjClient.value.trim() : "");
        const contractor = (elements.inputPrjContractor ? elements.inputPrjContractor.value.trim() : "");
        const subcontractor = (elements.inputPrjSubcontractor ? elements.inputPrjSubcontractor.value.trim() : "");
        const notes = (elements.inputPrjNotes ? elements.inputPrjNotes.value.trim() : "");

        if (!code || !name) {
            alert("Please fill in both Project Code and Project Name.");
            if (!code && elements.inputPrjCode) elements.inputPrjCode.focus();
            else if (!name && elements.inputPrjName) elements.inputPrjName.focus();
            return;
        }

        try {
            const resp = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: code,
                    name: name,
                    client: client,
                    contractor: contractor,
                    subcontractor: subcontractor,
                    notes: notes,
                    unit_system: state.unit
                })
            });
            const res = await resp.json();
            if (res.status === "success") {
                closeNewProjectModal();
                showPrjToast(`✓ Created Project: ${res.data.code} - ${res.data.name}`);
                await initProjectManager();
                if (elements.selectActiveProject) {
                    elements.selectActiveProject.value = res.data.id;
                }
            } else {
                alert(`Error: ${res.message || "Failed to create project"}`);
            }
        } catch (err) {
            console.error("Failed to save project:", err);
            alert("Network error creating project.");
        }
    }

    // --- Add Current Calculation (Fitting or Sized Duct) to Project ---
    function openAddFittingDialog() {
        if (!state.activeProjectId) {
            openNewProjectModal();
            return;
        }

        const data = state.activeData || {};
        const item = state.activeItem || getFallbackItem(state.activeCode);
        const code = state.activeCode || "CR11-1";
        const name = (item && (item.title || item.name)) ? (item.title || item.name) : code;
        const u = state.unit;
        const isSizer = (state.mode === "sizer" || code.startsWith("SIZE-"));

        const dpUnit = u === "SI" ? "Pa" : "in. wg";
        const flowUnit = u === "SI" ? "L/s" : "cfm";
        const velUnit = u === "SI" ? "m/s" : "fpm";
        const lenUnit = u === "SI" ? "m" : "ft";
        const frUnit = u === "SI" ? "Pa/m" : "in. wg/100ft";

        let dp = 0;
        let flow = 0;
        let vel = 0;
        let coeff = 0;
        let coeffType = "Co";
        let dimStr = "";

        if (isSizer) {
            if (elements.addFittingDialogTitle) {
                elements.addFittingDialogTitle.textContent = "Add Sized Duct Section to Project Schedule";
            }
            if (elements.groupFittingQty) elements.groupFittingQty.classList.add("hidden");
            if (elements.groupSizerLength) elements.groupSizerLength.classList.remove("hidden");
            if (elements.lblSizerLength) elements.lblSizerLength.textContent = `Run Length (${lenUnit}) *`;
            if (elements.lblFittingNotes) elements.lblFittingNotes.textContent = "Section / Room Description (e.g. AHU-1 Main Supply to VAV-1)";

            const fr = u === "SI" ? (data.friction_rate_pa_m || 0.8) : (data.friction_rate_in_100ft || 0.1);
            flow = u === "SI" ? (data.Q_Lps || 300) : (data.Q_cfm || 636);
            vel = u === "SI" ? (data.velocity_ms || 3.0) : (data.velocity_fpm || 600);

            if (elements.outSized && elements.outSized.textContent && elements.outSized.textContent !== "-") {
                dimStr = elements.outSized.textContent;
            } else if (data.rectangular && data.rectangular.W_mm && data.rectangular.H_mm) {
                dimStr = u === "SI" ? `${data.rectangular.W_mm} × ${data.rectangular.H_mm} mm` : `${(data.rectangular.W_mm/25.4).toFixed(0)} × ${(data.rectangular.H_mm/25.4).toFixed(0)} in.`;
            } else if (data.round && (data.round.D_nom_mm || data.round.D_exact_mm)) {
                const dVal = data.round.D_nom_mm || Math.round(data.round.D_exact_mm);
                dimStr = u === "SI" ? `Ø ${dVal} mm` : `Ø ${(dVal/25.4).toFixed(0)} in.`;
            } else {
                dimStr = "Sized Section";
            }

            if (elements.previewFittingName) {
                elements.previewFittingName.textContent = `Auto Sized Duct: ${dimStr}`;
            }
            if (elements.previewFittingStats) {
                elements.previewFittingStats.textContent = `Flow = ${flow.toFixed(0)} ${flowUnit} | Velocity = ${vel.toFixed(1)} ${velUnit} | Friction Rate = ${fr.toFixed(2)} ${frUnit}`;
            }

            const existingSegs = (state.activeProject && state.activeProject.duct_segments) ? state.activeProject.duct_segments.length : 0;
            if (elements.inputFittingTag) {
                elements.inputFittingTag.value = `DS-${String(existingSegs + 1).padStart(2, '0')}`;
            }
            if (elements.inputSizerLength) {
                elements.inputSizerLength.value = u === "SI" ? "1.0" : "10.0";
            }
            if (elements.inputFittingNotes) {
                elements.inputFittingNotes.value = "";
            }

        } else {
            // Fitting Loss Analysis mode
            if (elements.addFittingDialogTitle) {
                elements.addFittingDialogTitle.textContent = "Add Fitting to Project Schedule (ESP Calculation)";
            }
            if (elements.groupFittingQty) elements.groupFittingQty.classList.remove("hidden");
            if (elements.groupSizerLength) elements.groupSizerLength.classList.add("hidden");
            if (elements.lblFittingNotes) elements.lblFittingNotes.textContent = "Installation Notes / Location (Optional)";

            dp = u === "SI" ? (data.pressure_loss_pa || 0) : (data.pressure_loss_in_wg || 0);
            flow = u === "SI" ? (data.Q_Lps || 500) : (data.Q_cfm || 1059);
            vel = u === "SI" ? (data.velocity_ms || 3.0) : (data.velocity_fpm || 600);

            if (data.f !== undefined && data.C === undefined) {
                coeff = data.f;
                coeffType = "f";
            } else {
                coeff = (data.C !== undefined && data.C !== null) ? data.C : 0.15;
                coeffType = "Co";
            }

            const currentInputs = {};
            elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                currentInputs[inp.dataset.fieldId] = parseFloat(inp.value);
            });

            if (currentInputs.H && currentInputs.W) {
                dimStr = u === "SI" ? `${currentInputs.W} × ${currentInputs.H} mm` : `${currentInputs.W} × ${currentInputs.H} in.`;
            } else if (currentInputs.D) {
                dimStr = u === "SI" ? `Ø ${currentInputs.D} mm` : `Ø ${currentInputs.D} in.`;
            } else {
                dimStr = "Standard";
            }

            if (elements.previewFittingName) {
                elements.previewFittingName.textContent = formatFittingTitle(item || {code, name});
            }
            if (elements.previewFittingStats) {
                elements.previewFittingStats.textContent = `ΔP = ${dp.toFixed(1)} ${dpUnit} | Flow = ${flow.toFixed(0)} ${flowUnit} | ${coeffType} = ${Number(coeff).toFixed(4)}`;
            }

            if (state.editingFitting && state.editingFitting.code === code) {
                if (elements.addFittingDialogTitle) elements.addFittingDialogTitle.textContent = `Edit Fitting [${state.editingFitting.tag}]`;
                if (elements.inputFittingTag) elements.inputFittingTag.value = state.editingFitting.tag;
                if (elements.inputFittingQty) elements.inputFittingQty.value = String(state.editingFitting.qty || 1);
                if (elements.inputFittingNotes) elements.inputFittingNotes.value = state.editingFitting.notes || "";
                if (elements.btnConfirmAddFitting) elements.btnConfirmAddFitting.textContent = "💾 Update in Schedule";
            } else {
                state.editingFitting = null;
                if (elements.addFittingDialogTitle) elements.addFittingDialogTitle.textContent = "Add to Project Schedule";
                const existingFittings = (state.activeProject && state.activeProject.fittings) ? state.activeProject.fittings.length : 0;
                if (elements.inputFittingTag) {
                    elements.inputFittingTag.value = `${code}-F${String(existingFittings + 1).padStart(2, '0')}`;
                }
                if (elements.inputFittingQty) {
                    elements.inputFittingQty.value = "1";
                }
                if (elements.inputFittingNotes) {
                    elements.inputFittingNotes.value = "";
                }
                if (elements.btnConfirmAddFitting) elements.btnConfirmAddFitting.textContent = "➕ Confirm Add to Schedule";
            }
        }

        if (elements.addFittingProjectTarget) {
            const pName = state.activeProject ? state.activeProject.name : state.activeProjectId;
            elements.addFittingProjectTarget.textContent = `Target Project: ${pName}`;
        }

        if (elements.addFittingDialog) {
            elements.addFittingDialog.classList.remove("hidden");
        }
    }

    function closeAddFittingDialog() {
        if (elements.addFittingDialog) {
            elements.addFittingDialog.classList.add("hidden");
        }
    }

    async function confirmAddFitting() {
        if (!state.activeProjectId) return;

        const data = state.activeData || {};
        const item = state.activeItem || getFallbackItem(state.activeCode);
        const code = state.activeCode || "CR11-1";
        const name = (item && (item.title || item.name)) ? (item.title || item.name) : code;
        const u = state.unit;
        const isSizer = (state.mode === "sizer" || code.startsWith("SIZE-"));

        if (isSizer) {
            // Add Sized Duct Section to project.duct_segments
            let dimStr = "";
            if (elements.outSized && elements.outSized.textContent && elements.outSized.textContent !== "-") {
                dimStr = elements.outSized.textContent;
            } else if (data.rectangular && data.rectangular.W_mm && data.rectangular.H_mm) {
                dimStr = u === "SI" ? `${data.rectangular.W_mm} × ${data.rectangular.H_mm} mm` : `${(data.rectangular.W_mm/25.4).toFixed(0)} × ${(data.rectangular.H_mm/25.4).toFixed(0)} in.`;
            } else if (data.round && (data.round.D_nom_mm || data.round.D_exact_mm)) {
                const dVal = data.round.D_nom_mm || Math.round(data.round.D_exact_mm);
                dimStr = u === "SI" ? `Ø ${dVal} mm` : `Ø ${(dVal/25.4).toFixed(0)} in.`;
            } else {
                dimStr = "Sized Section";
            }

            const flow = u === "SI" ? (data.Q_Lps || 300) : (data.Q_cfm || 636);
            const vel = u === "SI" ? (data.velocity_ms || 3.0) : (data.velocity_fpm || 600);
            const fr = u === "SI" ? (data.friction_rate_pa_m || 0.8) : (data.friction_rate_in_100ft || 0.1);
            const lengthVal = parseFloat((elements.inputSizerLength && elements.inputSizerLength.value) || "1.0") || 1.0;
            const tag = (elements.inputFittingTag && elements.inputFittingTag.value.trim()) || "DS-01";
            const sectionName = (elements.inputFittingNotes && elements.inputFittingNotes.value.trim()) || `Duct Run ${tag}`;

            let deStr = "-";
            if (data.De_mm) {
                deStr = u === "SI" ? `${Math.round(data.De_mm)} mm` : `${(data.De_mm/25.4).toFixed(1)} in.`;
            }
            let arStr = "-";
            if (data.aspect_ratio) {
                arStr = Number(data.aspect_ratio).toFixed(2);
            }

            const payload = {
                tag: tag,
                section_name: sectionName,
                shape: state.sizerShape || (data.shape || "rect"),
                dimensions: dimStr,
                unit_system: u,
                Q: typeof flow === "number" ? Math.round(flow * 10) / 10 : flow,
                velocity: typeof vel === "number" ? Math.round(vel * 100) / 100 : vel,
                friction_rate: typeof fr === "number" ? Math.round(fr * 100) / 100 : fr,
                length: lengthVal,
                dp: Math.round(fr * lengthVal * 10) / 10,
                De: deStr,
                aspect_ratio: arStr,
                target_type: data.target_type || "friction",
                target_val: data.target_val || 0.8,
                notes: sectionName,
                steps: data.steps || []
            };

            try {
                const resp = await fetch(`/api/projects/${encodeURIComponent(state.activeProjectId)}/sizer-segments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const res = await resp.json();
                if (res.status === "success") {
                    closeAddFittingDialog();
                    await fetchActiveProjectDetails(state.activeProjectId);
                    updateProjectRibbonBadge();
                    showPrjToast(`✓ Added Sized Duct Section [${tag}] to ${state.activeProject ? state.activeProject.code : 'Project'}!`);
                } else {
                    alert(`Error: ${res.message || "Failed to add sized duct section"}`);
                }
            } catch (err) {
                console.error("Failed to add sizer segment to project:", err);
                alert("Network error adding duct segment.");
            }

        } else {
            // Add Fitting to project.fittings
            const currentInputs = {};
            elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                currentInputs[inp.dataset.fieldId] = parseFloat(inp.value);
            });

            let dimStr = "";
            if (currentInputs.H && currentInputs.W) {
                dimStr = `${currentInputs.W} × ${currentInputs.H} mm`;
            } else if (currentInputs.D) {
                dimStr = `Ø ${currentInputs.D} mm`;
            } else if (data.rectangular && data.rectangular.W_mm && data.rectangular.H_mm) {
                dimStr = `${data.rectangular.W_mm} × ${data.rectangular.H_mm} mm`;
            } else if (data.round && (data.round.D_nom_mm || data.round.D_exact_mm)) {
                const dVal = data.round.D_nom_mm || Math.round(data.round.D_exact_mm);
                dimStr = `Ø ${dVal} mm`;
            } else if (data.De_mm) {
                dimStr = `Eq. Ø ${Math.round(data.De_mm)} mm`;
            } else {
                dimStr = "Standard";
            }

            const flow = u === "SI" ? (data.Q_Lps || currentInputs.Q || 300) : (data.Q_cfm || currentInputs.Q || 636);
            const vel = u === "SI" ? (data.velocity_ms || 3.0) : (data.velocity_fpm || 600);
            const pv = u === "SI" ? (data.pv_pa || 5.0) : (data.pv_in_wg || 0.02);

            let coeff = 0;
            let coeffType = "Co";
            if (data.C !== undefined && data.C !== null) {
                coeff = data.C;
                coeffType = "Co";
            } else if (data.f !== undefined) {
                coeff = data.f;
                coeffType = "f";
            } else {
                coeff = 0.15;
                coeffType = "Co";
            }

            const dp = u === "SI" ? (data.pressure_loss_pa || 2.5) : (data.pressure_loss_in_wg || 0.01);
            const tag = (elements.inputFittingTag && elements.inputFittingTag.value.trim()) || `${code}-01`;
            const qty = parseInt((elements.inputFittingQty && elements.inputFittingQty.value) || "1", 10) || 1;
            const notes = (elements.inputFittingNotes ? elements.inputFittingNotes.value.trim() : "");

            const payload = {
                code: code,
                name: name,
                shape: (item && item.shape) ? item.shape : "rect",
                category: (item && item.category) ? item.category : "Fittings",
                dimensions: dimStr,
                inputs: currentInputs,
                unit_system: u,
                Q: typeof flow === "number" ? Math.round(flow * 10) / 10 : flow,
                velocity: typeof vel === "number" ? Math.round(vel * 100) / 100 : vel,
                pv: typeof pv === "number" ? Math.round(pv * 100) / 100 : pv,
                f_or_Co: typeof coeff === "number" ? Math.round(coeff * 10000) / 10000 : coeff,
                coeff_type: coeffType,
                dp: typeof dp === "number" ? Math.round(dp * 10) / 10 : dp,
                qty: qty,
                tag: tag,
                notes: notes
            };

            try {
                const isUpdating = state.editingFitting && state.editingFitting.id && (state.editingFitting.code === code);
                const url = isUpdating
                    ? `/api/projects/${encodeURIComponent(state.activeProjectId)}/fittings/${encodeURIComponent(state.editingFitting.id)}`
                    : `/api/projects/${encodeURIComponent(state.activeProjectId)}/fittings`;
                const method = isUpdating ? "PUT" : "POST";

                const resp = await fetch(url, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const res = await resp.json();
                if (res.status === "success") {
                    closeAddFittingDialog();
                    state.editingFitting = null;
                    await fetchActiveProjectDetails(state.activeProjectId);
                    updateProjectRibbonBadge();
                    showPrjToast(isUpdating
                        ? `✓ Updated ${code} [${tag}] in schedule!`
                        : `✓ Added ${code} [${tag}] to ${state.activeProject ? state.activeProject.code : 'Project'}!`
                    );
                } else {
                    alert(`Error: ${res.message || "Failed to save fitting"}`);
                }
            } catch (err) {
                console.error("Failed to save fitting to project:", err);
                alert("Network error saving fitting.");
            }
        }
    }

    // --- Switch Project Summary Tab ---
    function switchSummaryTab(tabName) {
        state.summaryTab = tabName;
        if (elements.tabSummaryFittings) {
            elements.tabSummaryFittings.classList.toggle("active", tabName === "fittings");
        }
        if (elements.tabSummarySizer) {
            elements.tabSummarySizer.classList.toggle("active", tabName === "sizer");
        }
        if (elements.viewSummaryFittings) {
            elements.viewSummaryFittings.classList.toggle("hidden", tabName !== "fittings");
        }
        if (elements.viewSummarySizer) {
            elements.viewSummarySizer.classList.toggle("hidden", tabName !== "sizer");
        }

        if (elements.btnDownloadFitductPdf) {
            elements.btnDownloadFitductPdf.textContent = tabName === "sizer" ? "📄 Download Duct Sizing Report (PDF)" : "📄 Download Duct Fitting Report (PDF)";
            elements.btnDownloadFitductPdf.title = tabName === "sizer" ? "Download Duct Sizing Report (table and step calculations only, no CAD)" : "Download Fitting Loss Report (ESP calculation with CAD blueprints)";
        }
        if (elements.btnClearProjectFittings) {
            elements.btnClearProjectFittings.textContent = tabName === "sizer" ? "🗑️ Clear Sized Runs" : "🗑️ Clear Fittings";
        }
    }

    // --- Project Summary & Fitting Schedule Modal ---
    async function openProjectSummaryModal() {
        if (!state.activeProjectId) {
            openNewProjectModal();
            return;
        }

        await fetchActiveProjectDetails(state.activeProjectId);
        const p = state.activeProject;
        if (!p) {
            alert("No project data available.");
            return;
        }

        if (elements.summaryValCode) elements.summaryValCode.textContent = p.code || "-";
        if (elements.summaryValName) elements.summaryValName.textContent = p.name || "-";
        if (elements.summaryValClient) elements.summaryValClient.textContent = p.client || "(Not specified)";
        if (elements.summaryValContractor) elements.summaryValContractor.textContent = p.contractor || "(Not specified)";
        if (elements.summaryValSubcontractor) elements.summaryValSubcontractor.textContent = p.subcontractor || "(Not specified)";

        // Initialize Design Safety Margin
        const marginVal = (p.design_margin !== undefined && p.design_margin !== null) ? Number(p.design_margin) : 10.0;
        if (elements.inputProjectDesignMargin) {
            elements.inputProjectDesignMargin.value = marginVal;
        }
        if (elements.marginPresetChips) {
            elements.marginPresetChips.querySelectorAll(".btn-margin-chip").forEach(btn => {
                const btnVal = parseFloat(btn.dataset.margin);
                btn.classList.toggle("active", Math.abs(btnVal - marginVal) < 0.01);
            });
        }

        // Set initial view based on current app mode
        switchSummaryTab(state.mode === "sizer" ? "sizer" : "fittings");

        renderProjectScheduleTable(p);
        renderSizerScheduleTable(p);

        if (elements.projectSummaryModal) {
            elements.projectSummaryModal.classList.remove("hidden");
        }
    }

    function closeProjectSummaryModal() {
        if (elements.projectSummaryModal) {
            elements.projectSummaryModal.classList.add("hidden");
        }
    }

    function renderProjectScheduleTable(p) {
        if (!elements.tbodyProjectSchedule) return;
        elements.tbodyProjectSchedule.innerHTML = "";

        const fittings = p.fittings || [];
        const isSI = (p.unit_system || state.unit) === "SI";
        const dpUnit = isSI ? "Pa" : "in. wg";
        const flowUnit = isSI ? "L/s" : "cfm";
        const velUnit = isSI ? "m/s" : "fpm";

        // Update thead with exact physical units in brackets
        if (elements.tableProjectSchedule) {
            const th = elements.tableProjectSchedule.querySelector("thead");
            if (th) {
                th.innerHTML = `
                    <tr>
                        <th style="width: 36px;" class="text-center">#</th>
                        <th style="width: 95px;">Tag / Mark</th>
                        <th style="width: 80px;" class="text-center">Code</th>
                        <th>Fitting Description</th>
                        <th style="width: 65px;" class="text-center">Shape</th>
                        <th style="width: 135px;">Dimensions</th>
                        <th style="width: 80px;" class="text-right">Q [${flowUnit}]</th>
                        <th style="width: 80px;" class="text-right">V [${velUnit}]</th>
                        <th style="width: 75px;" class="text-right">P<sub>v</sub> [${dpUnit}]</th>
                        <th style="width: 75px;" class="text-right">Co / f</th>
                        <th style="width: 80px;" class="text-right">ΔP [${dpUnit}]</th>
                        <th style="width: 65px;" class="text-center">Qty</th>
                        <th style="width: 90px;" class="text-right">Total ΔP [${dpUnit}]</th>
                        <th style="width: 80px;" class="text-center">Actions</th>
                    </tr>
                `;
            }
        }

        let totalQty = 0;
        let cumulativeDp = 0;
        let maxSingleDp = 0;
        let primaryFlow = "-";

        if (fittings.length === 0) {
            elements.tbodyProjectSchedule.innerHTML = `
                <tr>
                    <td colspan="14" style="text-align: center; padding: 30px; color: #64748b; font-style: italic;">
                        No fittings added to this project yet. Calculate any duct fitting and click "➕ Add to Project" to build the ESP schedule.
                    </td>
                </tr>
            `;
            if (elements.tfootProjectSchedule) elements.tfootProjectSchedule.innerHTML = "";
            if (elements.kpiTotalFittings) elements.kpiTotalFittings.textContent = "0";
            if (elements.kpiSubtotalDp) elements.kpiSubtotalDp.textContent = `0.0 ${dpUnit}`;
            if (elements.kpiTotalDp) elements.kpiTotalDp.textContent = `0.0 ${dpUnit}`;
            if (elements.kpiTotalDpSub) elements.kpiTotalDpSub.classList.add("hidden");
            if (elements.kpiMaxLoss) elements.kpiMaxLoss.textContent = `0.0 ${dpUnit}`;
            if (elements.kpiTotalAirflow) elements.kpiTotalAirflow.textContent = "-";
            return;
        }

        fittings.forEach((fit, idx) => {
            const tr = document.createElement("tr");

            const qVal = Number(fit.Q || 0);
            const vVal = Number(fit.velocity || 0);
            const pvVal = Number(fit.pv || 0);
            const coeffVal = Number(fit.f_or_Co || 0);
            const dpVal = Number(fit.dp || 0);
            const qtyVal = Number(fit.qty || 1);
            const totDpVal = Number(fit.total_dp || (dpVal * qtyVal));

            totalQty += qtyVal;
            cumulativeDp += totDpVal;
            if (dpVal > maxSingleDp) maxSingleDp = dpVal;
            if (idx === 0) primaryFlow = `${qVal.toFixed(0)} ${flowUnit}`;

            const shapeClass = (fit.shape || "rect").toLowerCase();

            tr.innerHTML = `
                <td style="color: #64748b; font-weight: 600;">${idx + 1}</td>
                <td><span class="tag-badge">${escapeHtml(fit.tag || `FIT-${idx+1}`)}</span></td>
                <td><span class="code-pill">${escapeHtml(fit.code)}</span></td>
                <td>
                    <div style="font-weight: 600; color: #0f172a;">${escapeHtml(fit.name || fit.code)}</div>
                    ${fit.notes ? `<div style="font-size: 10.5px; color: #64748b;">${escapeHtml(fit.notes)}</div>` : ''}
                </td>
                <td><span class="shape-badge ${shapeClass}">${shapeClass.toUpperCase()}</span></td>
                <td class="num-cell">${escapeHtml(fit.dimensions || '-')}</td>
                <td class="num-cell text-right">${qVal > 0 ? qVal.toFixed(0) : '-'}</td>
                <td class="num-cell text-right">${vVal > 0 ? vVal.toFixed(2) : '-'}</td>
                <td class="num-cell text-right">${pvVal > 0 ? pvVal.toFixed(1) : '-'}</td>
                <td class="num-cell text-right" title="${fit.coeff_type || 'Co'}">${coeffVal.toFixed(4)}</td>
                <td class="num-cell text-right loss-val">${dpVal.toFixed(1)}</td>
                <td class="num-cell text-center" style="font-weight: bold;">${qtyVal}</td>
                <td class="num-cell text-right total-loss-val">${totDpVal.toFixed(1)}</td>
                <td class="text-center">
                    <div style="display: inline-flex; gap: 4px; justify-content: center;">
                        <button type="button" class="btn-table-action edit-fit btn-load-fit" title="Edit this Fitting" data-fit-id="${fit.id}">✏️</button>
                        <button type="button" class="btn-table-action delete btn-del-fit" title="Delete from schedule" data-fit-id="${fit.id}">🗑️</button>
                    </div>
                </td>
            `;

            const btnLoad = tr.querySelector(".btn-load-fit");
            if (btnLoad) {
                btnLoad.addEventListener("click", () => loadFittingFromSchedule(fit));
            }
            const btnDel = tr.querySelector(".btn-del-fit");
            if (btnDel) {
                btnDel.addEventListener("click", () => deleteFittingFromSchedule(fit.id));
            }

            elements.tbodyProjectSchedule.appendChild(tr);
        });

        const marginPct = (p.design_margin !== undefined && p.design_margin !== null) ? Number(p.design_margin) : 10.0;
        const marginStr = `${marginPct % 1 === 0 ? marginPct.toFixed(0) : marginPct.toFixed(1)}%`;
        const marginDp = cumulativeDp * (marginPct / 100.0);
        const designDp = cumulativeDp + marginDp;

        if (elements.tfootProjectSchedule) {
            if (marginPct > 0) {
                elements.tfootProjectSchedule.innerHTML = `
                    <tr style="background: #f8fafc; border-top: 1.5px solid #cbd5e1; font-size: 12px; color: #475569;">
                        <td colspan="11" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; white-space: nowrap;">Subtotal Calculated Loss (∑ΔP<sub>calc</sub>):</td>
                        <td class="text-center num-cell" style="font-weight: 700; white-space: nowrap;">${totalQty}</td>
                        <td class="text-right num-cell" style="font-weight: 700; white-space: nowrap;">${cumulativeDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                    <tr style="background: #f0f9ff; border-top: 1px dashed #93c5fd; font-size: 12px; color: #0369a1;">
                        <td colspan="11" style="text-align: right; font-weight: 600; white-space: nowrap;">Design Safety Margin (+${marginStr}):</td>
                        <td class="text-center num-cell" style="font-weight: 700; color: #0284c7; white-space: nowrap;">+${marginStr}</td>
                        <td class="text-right num-cell" style="font-weight: 700; color: #0284c7; white-space: nowrap;">+${marginDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                    <tr style="background: #f0fdf4; border-top: 2px solid #16a34a; border-bottom: 2.5px solid #16a34a; color: #166534;">
                        <td colspan="11" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12.5px; font-weight: 800; white-space: nowrap;">Total Design Pressure Loss / Fan ESP (∑ΔP<sub>design</sub>):</td>
                        <td class="text-center num-cell" style="font-size: 13px; font-weight: 800; white-space: nowrap;">${totalQty}</td>
                        <td class="text-right num-cell" style="font-size: 14px; color: #15803d; font-weight: 800; white-space: nowrap;">${designDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                `;
            } else {
                elements.tfootProjectSchedule.innerHTML = `
                    <tr style="background: #f0fdf4; border-top: 2px solid #16a34a; border-bottom: 2.5px solid #16a34a; color: #166534;">
                        <td colspan="11" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12.5px; font-weight: 800; white-space: nowrap;">Total Design Pressure Loss / Fan ESP (∑ΔP):</td>
                        <td class="text-center num-cell" style="font-size: 13px; font-weight: 800; white-space: nowrap;">${totalQty}</td>
                        <td class="text-right num-cell" style="font-size: 14px; color: #15803d; font-weight: 800; white-space: nowrap;">${cumulativeDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                `;
            }
        }

        if (elements.kpiTotalFittings) elements.kpiTotalFittings.textContent = String(fittings.length);
        if (elements.kpiSubtotalDp) elements.kpiSubtotalDp.textContent = `${cumulativeDp.toFixed(1)} ${dpUnit}`;
        if (elements.kpiTotalDp) elements.kpiTotalDp.textContent = `${designDp.toFixed(1)} ${dpUnit}`;
        if (elements.kpiTotalDpLabel) {
            elements.kpiTotalDpLabel.textContent = marginPct > 0 ? "Total Design Loss / Fan ESP" : "Total Pressure Loss (∑ΔP)";
        }
        if (elements.kpiTotalDpSub) {
            elements.kpiTotalDpSub.textContent = marginPct > 0 ? `incl. +${marginStr} Margin` : "No margin";
            elements.kpiTotalDpSub.classList.toggle("hidden", marginPct === 0);
        }
        if (elements.kpiMaxLoss) elements.kpiMaxLoss.textContent = `${maxSingleDp.toFixed(1)} ${dpUnit}`;
        if (elements.kpiTotalAirflow) elements.kpiTotalAirflow.textContent = primaryFlow;
    }

    function renderSizerScheduleTable(p) {
        if (!elements.tbodySizerSchedule) return;
        elements.tbodySizerSchedule.innerHTML = "";

        const segments = p.duct_segments || [];
        const isSI = (p.unit_system || state.unit) === "SI";
        const dpUnit = isSI ? "Pa" : "in. wg";
        const flowUnit = isSI ? "L/s" : "cfm";
        const velUnit = isSI ? "m/s" : "fpm";
        const lenUnit = isSI ? "m" : "ft";
        const frUnit = isSI ? "Pa/m" : "in. wg/100ft";
        const deUnit = isSI ? "mm" : "in.";

        // Update thead with exact physical units in brackets
        if (elements.tableSizerSchedule) {
            const th = elements.tableSizerSchedule.querySelector("thead");
            if (th) {
                th.innerHTML = `
                    <tr>
                        <th style="width: 36px;" class="text-center">#</th>
                        <th style="width: 95px;">Tag / Mark</th>
                        <th>Duct Section / Description</th>
                        <th style="width: 65px;" class="text-center">Shape</th>
                        <th style="width: 140px;">Sized Dimensions</th>
                        <th style="width: 80px;" class="text-right">Q [${flowUnit}]</th>
                        <th style="width: 80px;" class="text-right">V [${velUnit}]</th>
                        <th style="width: 80px;" class="text-right">Eq. D<sub>e</sub> [${deUnit}]</th>
                        <th style="width: 65px;" class="text-right">AR [W/H]</th>
                        <th style="width: 90px;" class="text-right">Rate [${frUnit}]</th>
                        <th style="width: 75px;" class="text-right">Length [${lenUnit}]</th>
                        <th style="width: 85px;" class="text-right">Loss (ΔP) [${dpUnit}]</th>
                        <th style="width: 70px;" class="text-center">Actions</th>
                    </tr>
                `;
            }
        }

        let totalLength = 0;
        let cumulativeDp = 0;

        if (segments.length === 0) {
            elements.tbodySizerSchedule.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; padding: 30px; color: #64748b; font-style: italic;">
                        No sized duct sections added to this project yet. Use "Auto Duct Sizer" to size any duct section and click "➕ Add to Project" to add it to the sizing schedule.
                    </td>
                </tr>
            `;
            if (elements.tfootSizerSchedule) elements.tfootSizerSchedule.innerHTML = "";
            if (elements.kpiSizerRuns) elements.kpiSizerRuns.textContent = "0";
            if (elements.kpiSizerLength) elements.kpiSizerLength.textContent = `0.0 ${lenUnit}`;
            if (elements.kpiSizerSubtotalDp) elements.kpiSizerSubtotalDp.textContent = `0.0 ${dpUnit}`;
            if (elements.kpiSizerTotalDp) elements.kpiSizerTotalDp.textContent = `0.0 ${dpUnit}`;
            if (elements.kpiSizerTotalDpSub) elements.kpiSizerTotalDpSub.classList.add("hidden");
            if (elements.kpiSizerAvgRate) elements.kpiSizerAvgRate.textContent = `0.80 ${frUnit}`;
            return;
        }

        segments.forEach((seg, idx) => {
            const tr = document.createElement("tr");

            const qVal = Number(seg.Q || 0);
            const vVal = Number(seg.velocity || 0);
            const frVal = Number(seg.friction_rate || 0);
            const lenVal = Number(seg.length || 1);
            const dpVal = Number(seg.dp || (frVal * lenVal));

            totalLength += lenVal;
            cumulativeDp += dpVal;

            const shapeClass = (seg.shape || "rect").toLowerCase();

            tr.innerHTML = `
                <td style="color: #64748b; font-weight: 600;">${idx + 1}</td>
                <td><span class="tag-badge">${escapeHtml(seg.tag || `DS-${idx+1}`)}</span></td>
                <td>
                    <div style="font-weight: 600; color: #0f172a;">${escapeHtml(seg.section_name || `Section ${idx+1}`)}</div>
                    ${seg.notes && seg.notes !== seg.section_name ? `<div style="font-size: 10.5px; color: #64748b;">${escapeHtml(seg.notes)}</div>` : ''}
                </td>
                <td><span class="shape-badge ${shapeClass}">${shapeClass.toUpperCase()}</span></td>
                <td class="num-cell" style="font-weight: 700; color: #166534;">${escapeHtml(seg.dimensions || '-')}</td>
                <td class="num-cell text-right">${qVal > 0 ? qVal.toFixed(0) : '-'}</td>
                <td class="num-cell text-right">${vVal > 0 ? vVal.toFixed(2) : '-'}</td>
                <td class="num-cell text-right">${escapeHtml(String(seg.De || '-'))}</td>
                <td class="num-cell text-right">${escapeHtml(String(seg.aspect_ratio || '-'))}</td>
                <td class="num-cell text-right">${frVal.toFixed(2)}</td>
                <td class="num-cell text-right">${lenVal.toFixed(1)}</td>
                <td class="num-cell text-right total-loss-val">${dpVal.toFixed(1)}</td>
                <td class="text-center">
                    <button type="button" class="btn-table-action delete btn-del-seg" title="Delete from sizing schedule" data-seg-id="${seg.id}">🗑️</button>
                </td>
            `;

            const btnDel = tr.querySelector(".btn-del-seg");
            if (btnDel) {
                btnDel.addEventListener("click", () => deleteSizerSegmentFromSchedule(seg.id));
            }

            elements.tbodySizerSchedule.appendChild(tr);
        });

        const avgRate = totalLength > 0 ? (cumulativeDp / totalLength) : 0.8;
        const marginPct = (p.design_margin !== undefined && p.design_margin !== null) ? Number(p.design_margin) : 10.0;
        const marginStr = `${marginPct % 1 === 0 ? marginPct.toFixed(0) : marginPct.toFixed(1)}%`;
        const marginDp = cumulativeDp * (marginPct / 100.0);
        const designDp = cumulativeDp + marginDp;

        if (elements.tfootSizerSchedule) {
            if (marginPct > 0) {
                elements.tfootSizerSchedule.innerHTML = `
                    <tr style="background: #f8fafc; border-top: 1.5px solid #cbd5e1; font-size: 12px; color: #475569;">
                        <td colspan="10" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; white-space: nowrap;">Subtotal Friction Loss (∑ΔP<sub>calc</sub>):</td>
                        <td class="text-right num-cell" style="font-size: 13px; font-weight: 700; white-space: nowrap;">${totalLength.toFixed(1)} ${lenUnit}</td>
                        <td class="text-right num-cell" style="font-size: 13px; font-weight: 700; white-space: nowrap;">${cumulativeDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                    <tr style="background: #f0f9ff; border-top: 1px dashed #93c5fd; font-size: 12px; color: #0369a1;">
                        <td colspan="10" style="text-align: right; font-weight: 600; white-space: nowrap;">Design Safety Margin (+${marginStr}):</td>
                        <td class="text-right num-cell" style="font-size: 13px; font-weight: 700; color: #0284c7; white-space: nowrap;">+${marginStr}</td>
                        <td class="text-right num-cell" style="font-size: 13px; font-weight: 700; color: #0284c7; white-space: nowrap;">+${marginDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                    <tr style="background: #f0fdf4; border-top: 2px solid #16a34a; border-bottom: 2.5px solid #16a34a; color: #166534;">
                        <td colspan="10" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12.5px; font-weight: 800; white-space: nowrap;">Total Sizing Design Friction Loss (∑ΔP<sub>design</sub>):</td>
                        <td class="text-right num-cell" style="font-size: 13px; font-weight: 800; white-space: nowrap;">${totalLength.toFixed(1)} ${lenUnit}</td>
                        <td class="text-right num-cell" style="font-size: 14px; color: #15803d; font-weight: 800; white-space: nowrap;">${designDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                `;
            } else {
                elements.tfootSizerSchedule.innerHTML = `
                    <tr style="background: #f0fdf4; border-top: 2px solid #16a34a; border-bottom: 2.5px solid #16a34a; color: #166534;">
                        <td colspan="10" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12.5px; font-weight: 800; white-space: nowrap;">Total Straight Duct Run Friction Loss (∑ΔP):</td>
                        <td class="text-right num-cell" style="font-size: 13px; font-weight: 800; white-space: nowrap;">${totalLength.toFixed(1)} ${lenUnit}</td>
                        <td class="text-right num-cell" style="font-size: 14px; color: #15803d; font-weight: 800; white-space: nowrap;">${cumulativeDp.toFixed(1)} ${dpUnit}</td>
                        <td></td>
                    </tr>
                `;
            }
        }

        if (elements.kpiSizerRuns) elements.kpiSizerRuns.textContent = String(segments.length);
        if (elements.kpiSizerLength) elements.kpiSizerLength.textContent = `${totalLength.toFixed(1)} ${lenUnit}`;
        if (elements.kpiSizerSubtotalDp) elements.kpiSizerSubtotalDp.textContent = `${cumulativeDp.toFixed(1)} ${dpUnit}`;
        if (elements.kpiSizerTotalDp) elements.kpiSizerTotalDp.textContent = `${designDp.toFixed(1)} ${dpUnit}`;
        if (elements.kpiSizerTotalDpLabel) {
            elements.kpiSizerTotalDpLabel.textContent = marginPct > 0 ? "Total Sizing Design Loss" : "Total Friction Loss (∑ΔP)";
        }
        if (elements.kpiSizerTotalDpSub) {
            elements.kpiSizerTotalDpSub.textContent = marginPct > 0 ? `incl. +${marginStr} Margin` : "No margin";
            elements.kpiSizerTotalDpSub.classList.toggle("hidden", marginPct === 0);
        }
        if (elements.kpiSizerAvgRate) elements.kpiSizerAvgRate.textContent = `${avgRate.toFixed(2)} ${frUnit}`;
    }

    async function deleteSizerSegmentFromSchedule(segId) {
        if (!state.activeProjectId || !segId) return;
        if (!confirm("Are you sure you want to remove this sized duct section from the schedule?")) return;

        try {
            const resp = await fetch(`/api/projects/${encodeURIComponent(state.activeProjectId)}/sizer-segments/${encodeURIComponent(segId)}`, {
                method: "DELETE"
            });
            const res = await resp.json();
            if (res.status === "success") {
                await fetchActiveProjectDetails(state.activeProjectId);
                renderSizerScheduleTable(state.activeProject);
                updateProjectRibbonBadge();
                showPrjToast("🗑️ Sized duct section removed from schedule");
            }
        } catch (err) {
            console.error("Failed to delete sizer segment:", err);
        }
    }

    function loadFittingFromSchedule(fit) {
        state.editingFitting = fit;
        closeProjectSummaryModal();
        if (fit.unit_system && fit.unit_system !== state.unit) {
            setUnit(fit.unit_system);
        }

        if (fit.code && fit.code.startsWith("SIZE-")) {
            setMode("sizer");
        } else {
            selectFitting(fit.code);
        }

        setTimeout(() => {
            if (fit.inputs) {
                elements.inputTableBody.querySelectorAll("input").forEach(inp => {
                    const fid = inp.dataset.fieldId;
                    if (fid in fit.inputs && fit.inputs[fid] !== undefined) {
                        inp.value = fit.inputs[fid];
                    }
                });
                calculate();
            }
            showPrjToast(`✏️ Loaded ${fit.tag} (${fit.code}) into engineering calculator for editing`);
        }, 300);
    }

    async function deleteFittingFromSchedule(fittingId) {
        if (!state.activeProjectId || !fittingId) return;
        if (!confirm("Are you sure you want to remove this fitting from the schedule?")) return;

        try {
            const resp = await fetch(`/api/projects/${encodeURIComponent(state.activeProjectId)}/fittings/${encodeURIComponent(fittingId)}`, {
                method: "DELETE"
            });
            const res = await resp.json();
            if (res.status === "success") {
                await fetchActiveProjectDetails(state.activeProjectId);
                renderProjectScheduleTable(state.activeProject);
                updateProjectRibbonBadge();
                showPrjToast("🗑️ Fitting removed from schedule");
            }
        } catch (err) {
            console.error("Failed to delete fitting:", err);
        }
    }

    async function clearProjectFittings() {
        if (!state.activeProjectId) return;
        const isSizerTab = state.summaryTab === "sizer";
        const promptMsg = isSizerTab
            ? `Are you sure you want to remove ALL sized duct sections from ${state.activeProject ? state.activeProject.name : 'this project'}?`
            : `Are you sure you want to remove ALL duct fittings from ${state.activeProject ? state.activeProject.name : 'this project'}?`;

        if (!confirm(promptMsg)) return;

        try {
            const url = isSizerTab
                ? `/api/projects/${encodeURIComponent(state.activeProjectId)}/sizer-segments/clear`
                : `/api/projects/${encodeURIComponent(state.activeProjectId)}/clear`;

            const resp = await fetch(url, { method: "POST" });
            const res = await resp.json();
            if (res.status === "success") {
                await fetchActiveProjectDetails(state.activeProjectId);
                if (isSizerTab) {
                    renderSizerScheduleTable(state.activeProject);
                } else {
                    renderProjectScheduleTable(state.activeProject);
                }
                updateProjectRibbonBadge();
                showPrjToast(isSizerTab ? "🗑️ All sized duct sections cleared" : "🗑️ All fittings cleared");
            }
        } catch (err) {
            console.error("Failed to clear schedule items:", err);
        }
    }

    function exportProjectScheduleToCsv() {
        const p = state.activeProject;
        if (!p) {
            alert("No project selected.");
            return;
        }

        const isSizerTab = state.summaryTab === "sizer";
        const isSI = (p.unit_system || state.unit) === "SI";
        const dpUnit = isSI ? "Pa" : "in. wg";
        const flowUnit = isSI ? "L/s" : "cfm";
        const velUnit = isSI ? "m/s" : "fpm";
        const lenUnit = isSI ? "m" : "ft";
        const frUnit = isSI ? "Pa/m" : "in. wg/100ft";

        let csv = "";

        if (isSizerTab) {
            const segments = p.duct_segments || [];
            if (segments.length === 0) {
                alert("No sized duct sections to export. Add sized sections first.");
                return;
            }

            csv += "PROJECT DUCT SIZING SCHEDULE (ASHRAE FUNDAMENTALS CH. 21)\n";
            csv += `Standard,ANSI / ASHRAE Fundamentals (Ch. 21)\n`;
            csv += `Project Code,${csvEscape(p.code)}\n`;
            csv += `Project Name,${csvEscape(p.name)}\n`;
            csv += `Client,${csvEscape(p.client || 'N/A')}\n`;
            csv += `Contractor,${csvEscape(p.contractor || 'N/A')}\n`;
            csv += `Date Generated,${formatAppDate(new Date())}\n\n`;

            csv += `#,Tag / Mark,Section / Description,Shape,Sized Dimensions,Flow Rate (${flowUnit}),Velocity (${velUnit}),Eq. De,Aspect Ratio,Friction Rate (${frUnit}),Run Length (${lenUnit}),Section Loss (${dpUnit})\n`;

            let totLength = 0;
            let totLoss = 0;

            segments.forEach((seg, i) => {
                const len = Number(seg.length || 1);
                const dp = Number(seg.dp || 0);
                totLength += len;
                totLoss += dp;

                csv += `${i + 1},`;
                csv += `${csvEscape(seg.tag || '')},`;
                csv += `${csvEscape(seg.section_name || '')},`;
                csv += `${csvEscape(seg.shape || '')},`;
                csv += `${csvEscape(seg.dimensions || '')},`;
                csv += `${seg.Q || ''},`;
                csv += `${seg.velocity || ''},`;
                csv += `${csvEscape(seg.De || '')},`;
                csv += `${csvEscape(seg.aspect_ratio || '')},`;
                csv += `${seg.friction_rate || ''},`;
                csv += `${len.toFixed(1)},`;
                csv += `${dp.toFixed(1)}\n`;
            });

            const marginPct = (p.design_margin !== undefined && p.design_margin !== null) ? Number(p.design_margin) : 10.0;
            const marginStr = `${marginPct % 1 === 0 ? marginPct.toFixed(0) : marginPct.toFixed(1)}%`;
            const marginDp = totLoss * (marginPct / 100.0);
            const designDp = totLoss + marginDp;

            csv += `,,,,,,,,,SUBTOTAL (Calculated Friction Loss),${totLength.toFixed(1)},${totLoss.toFixed(1)}\n`;
            if (marginPct > 0) {
                csv += `,,,,,,,,,DESIGN SAFETY MARGIN (+${marginStr}),,+${marginDp.toFixed(1)}\n`;
                csv += `,,,,,,,,,TOTAL SIZING DESIGN LOSS,,${designDp.toFixed(1)}\n`;
            } else {
                csv += `,,,,,,,,,TOTALS,${totLength.toFixed(1)},${totLoss.toFixed(1)}\n`;
            }

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${p.code || 'Project'}_Duct_Sizing_Schedule.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showPrjToast("📥 Exported duct sizing schedule to CSV spreadsheet");

        } else {
            const fittings = p.fittings || [];
            if (fittings.length === 0) {
                alert("No fittings to export. Add fittings to the schedule first.");
                return;
            }

            csv += "PROJECT DUCT FITTING SCHEDULE (ASHRAE FUNDAMENTALS CH. 21)\n";
            csv += `Standard,ANSI / ASHRAE Fundamentals (Ch. 21)\n`;
            csv += `Project Code,${csvEscape(p.code)}\n`;
            csv += `Project Name,${csvEscape(p.name)}\n`;
            csv += `Client,${csvEscape(p.client || 'N/A')}\n`;
            csv += `Contractor,${csvEscape(p.contractor || 'N/A')}\n`;
            csv += `Sub Contractor,${csvEscape(p.subcontractor || 'N/A')}\n`;
            csv += `Date Generated,${formatAppDate(new Date())}\n\n`;

            csv += `#,Item Tag,Fitting Code,Fitting Description,Shape,Dimensions,Flow Rate (${flowUnit}),Velocity (${velUnit}),Pv (${dpUnit}),Co/f,Unit Loss (${dpUnit}),Quantity,Total Loss (${dpUnit}),Notes\n`;

            let cumDp = 0;
            let totQty = 0;

            fittings.forEach((fit, i) => {
                const dp = Number(fit.dp || 0);
                const qty = Number(fit.qty || 1);
                const totDp = Number(fit.total_dp || (dp * qty));
                cumDp += totDp;
                totQty += qty;

                csv += `${i + 1},`;
                csv += `${csvEscape(fit.tag || '')},`;
                csv += `${csvEscape(fit.code)},`;
                csv += `${csvEscape(fit.name || '')},`;
                csv += `${csvEscape(fit.shape || '')},`;
                csv += `${csvEscape(fit.dimensions || '')},`;
                csv += `${fit.Q || ''},`;
                csv += `${fit.velocity || ''},`;
                csv += `${fit.pv || ''},`;
                csv += `${fit.f_or_Co || ''},`;
                csv += `${dp.toFixed(2)},`;
                csv += `${qty},`;
                csv += `${totDp.toFixed(2)},`;
                csv += `${csvEscape(fit.notes || '')}\n`;
            });

            const marginPct = (p.design_margin !== undefined && p.design_margin !== null) ? Number(p.design_margin) : 10.0;
            const marginStr = `${marginPct % 1 === 0 ? marginPct.toFixed(0) : marginPct.toFixed(1)}%`;
            const marginDp = cumDp * (marginPct / 100.0);
            const designDp = cumDp + marginDp;

            csv += `,,,,,,,,,,SUBTOTAL (Calculated Loss),${totQty},${cumDp.toFixed(2)},\n`;
            if (marginPct > 0) {
                csv += `,,,,,,,,,,DESIGN SAFETY MARGIN (+${marginStr}),,+${marginDp.toFixed(2)},\n`;
                csv += `,,,,,,,,,,TOTAL DESIGN FAN ESP,,${designDp.toFixed(2)},\n`;
            } else {
                csv += `,,,,,,,,,,TOTALS,${totQty},${cumDp.toFixed(2)},\n`;
            }

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${p.code || 'Project'}_Fitting_Schedule.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showPrjToast("📥 Exported fitting schedule to CSV spreadsheet");
        }
    }

    function csvEscape(val) {
        if (!val) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    }

    function downloadFitductPdf() {
        const prjId = state.activeProjectId;
        if (!prjId) {
            showPrjToast("Please select or create an active project first.");
            return;
        }

        const includeCalcs = elements.chkIncludeCalculations ? (elements.chkIncludeCalculations.checked ? "1" : "0") : "1";
        const marginVal = elements.inputProjectDesignMargin ? elements.inputProjectDesignMargin.value : (state.activeProject?.design_margin ?? 10);

        if (state.summaryTab === "sizer") {
            showPrjToast(includeCalcs === "1"
                ? "Generating official DuctFit Pro Duct Sizing Report with calculations (PDF)..."
                : "Generating official DuctFit Pro Duct Sizing Report without calculations (PDF)...");
            window.location.href = `/api/projects/${encodeURIComponent(prjId)}/sizer-pdf?calc=${includeCalcs}&margin=${encodeURIComponent(marginVal)}`;
        } else {
            showPrjToast(includeCalcs === "1"
                ? "Generating official DuctFit Pro Duct Fitting Report with calculations (PDF)..."
                : "Generating official DuctFit Pro Duct Fitting Report without calculations (PDF)...");
            window.location.href = `/api/projects/${encodeURIComponent(prjId)}/pdf?calc=${includeCalcs}&margin=${encodeURIComponent(marginVal)}`;
        }
    }

    function printProjectReport() {
        window.print();
    }

    let toastTimeout = null;
    function showPrjToast(msg) {
        if (!elements.prjToastNotification) return;
        elements.prjToastNotification.textContent = msg;
        elements.prjToastNotification.classList.remove("hidden");
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            elements.prjToastNotification.classList.add("hidden");
        }, 3500);
    }

    function setupProjectListeners() {
        if (elements.selectActiveProject) {
            elements.selectActiveProject.addEventListener("change", (e) => {
                switchActiveProject(e.target.value);
            });
        }

        // Searchable Project Combo Dropdown
        if (elements.prjComboTrigger) {
            elements.prjComboTrigger.addEventListener("click", (e) => {
                e.stopPropagation();
                togglePrjComboDropdown();
            });
        }

        if (elements.prjComboSearchInput) {
            elements.prjComboSearchInput.addEventListener("input", (e) => {
                renderPrjComboList(e.target.value);
            });
            elements.prjComboSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const firstItem = elements.prjComboList ? elements.prjComboList.querySelector(".prj-combo-item") : null;
                    if (firstItem) {
                        const pid = firstItem.getAttribute("data-project-id");
                        if (pid) {
                            closePrjComboDropdown();
                            switchActiveProject(pid);
                        }
                    }
                }
            });
            elements.prjComboSearchInput.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }

        if (elements.btnClearComboSearch) {
            elements.btnClearComboSearch.addEventListener("click", (e) => {
                e.stopPropagation();
                if (elements.prjComboSearchInput) {
                    elements.prjComboSearchInput.value = "";
                    renderPrjComboList("");
                    elements.prjComboSearchInput.focus();
                }
            });
        }

        if (elements.btnComboNewProject) {
            elements.btnComboNewProject.addEventListener("click", (e) => {
                e.stopPropagation();
                closePrjComboDropdown();
                openNewProjectModal();
            });
        }

        if (elements.btnComboManageAll) {
            elements.btnComboManageAll.addEventListener("click", (e) => {
                e.stopPropagation();
                closePrjComboDropdown();
                openAllProjectsModal();
            });
        }

        // Manage All Projects
        if (elements.btnManageAllProjects) {
            elements.btnManageAllProjects.addEventListener("click", openAllProjectsModal);
        }
        if (elements.btnCloseAllProjectsModal) {
            elements.btnCloseAllProjectsModal.addEventListener("click", closeAllProjectsModal);
        }
        if (elements.btnCloseAllProjectsBottom) {
            elements.btnCloseAllProjectsBottom.addEventListener("click", closeAllProjectsModal);
        }
        if (elements.btnAllProjectsCreateNew) {
            elements.btnAllProjectsCreateNew.addEventListener("click", () => {
                openNewProjectModal();
            });
        }
        if (elements.inputFilterAllProjects) {
            elements.inputFilterAllProjects.addEventListener("input", (e) => {
                renderAllProjectsTable(e.target.value);
            });
            elements.inputFilterAllProjects.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const firstBtn = elements.tbodyAllProjects ? elements.tbodyAllProjects.querySelector(".btn-set-active") : null;
                    if (firstBtn) {
                        firstBtn.click();
                    }
                }
            });
        }
        if (elements.btnClearFilterAllProjects) {
            elements.btnClearFilterAllProjects.addEventListener("click", () => {
                if (elements.inputFilterAllProjects) {
                    elements.inputFilterAllProjects.value = "";
                    renderAllProjectsTable("");
                    elements.inputFilterAllProjects.focus();
                }
            });
        }

        // Edit Project Modal
        if (elements.btnCloseEditProjectModal) {
            elements.btnCloseEditProjectModal.addEventListener("click", closeEditProjectModal);
        }
        if (elements.btnCancelEditProject) {
            elements.btnCancelEditProject.addEventListener("click", closeEditProjectModal);
        }
        if (elements.btnSaveEditProject) {
            elements.btnSaveEditProject.addEventListener("click", saveEditProject);
        }

        if (elements.btnAddNewProject) {
            elements.btnAddNewProject.addEventListener("click", openNewProjectModal);
        }
        if (elements.btnCloseNewProjectModal) {
            elements.btnCloseNewProjectModal.addEventListener("click", closeNewProjectModal);
        }
        if (elements.btnCancelNewProject) {
            elements.btnCancelNewProject.addEventListener("click", closeNewProjectModal);
        }
        if (elements.btnSaveNewProject) {
            elements.btnSaveNewProject.addEventListener("click", saveNewProject);
        }

        if (elements.btnAddToProject) {
            elements.btnAddToProject.addEventListener("click", openAddFittingDialog);
        }

        if (elements.btnCloseAddFittingDialog) {
            elements.btnCloseAddFittingDialog.addEventListener("click", closeAddFittingDialog);
        }
        if (elements.btnCancelAddFitting) {
            elements.btnCancelAddFitting.addEventListener("click", closeAddFittingDialog);
        }
        if (elements.btnConfirmAddFitting) {
            elements.btnConfirmAddFitting.addEventListener("click", confirmAddFitting);
        }

        if (elements.tabSummaryFittings) {
            elements.tabSummaryFittings.addEventListener("click", () => switchSummaryTab("fittings"));
        }
        if (elements.tabSummarySizer) {
            elements.tabSummarySizer.addEventListener("click", () => switchSummaryTab("sizer"));
        }

        if (elements.btnProjectSummary) {
            elements.btnProjectSummary.addEventListener("click", openProjectSummaryModal);
        }
        if (elements.btnClosePrjSummaryModal) {
            elements.btnClosePrjSummaryModal.addEventListener("click", closeProjectSummaryModal);
        }
        if (elements.btnClosePrjSummaryBottom) {
            elements.btnClosePrjSummaryBottom.addEventListener("click", closeProjectSummaryModal);
        }
        if (elements.btnDownloadFitductPdf) {
            elements.btnDownloadFitductPdf.addEventListener("click", downloadFitductPdf);
        }
        if (elements.btnExportProjectCsv) {
            elements.btnExportProjectCsv.addEventListener("click", exportProjectScheduleToCsv);
        }
        if (elements.btnPrintProjectReport) {
            elements.btnPrintProjectReport.addEventListener("click", printProjectReport);
        }
        if (elements.btnClearProjectFittings) {
            elements.btnClearProjectFittings.addEventListener("click", clearProjectFittings);
        }

        // Project Design Safety Margin Listeners
        let marginSaveTimeout = null;
        function handleMarginChange(newMargin) {
            if (!state.activeProjectId) return;
            const val = Math.max(0, Math.min(100, parseFloat(newMargin) || 0));
            if (state.activeProject) {
                state.activeProject.design_margin = val;
                renderProjectScheduleTable(state.activeProject);
                renderSizerScheduleTable(state.activeProject);
            }
            if (elements.inputProjectDesignMargin && document.activeElement !== elements.inputProjectDesignMargin) {
                elements.inputProjectDesignMargin.value = val;
            }
            if (elements.marginPresetChips) {
                elements.marginPresetChips.querySelectorAll(".btn-margin-chip").forEach(btn => {
                    const btnVal = parseFloat(btn.dataset.margin);
                    btn.classList.toggle("active", Math.abs(btnVal - val) < 0.01);
                });
            }
            if (marginSaveTimeout) clearTimeout(marginSaveTimeout);
            marginSaveTimeout = setTimeout(async () => {
                try {
                    await fetch(`/api/projects/${encodeURIComponent(state.activeProjectId)}/margin`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ margin: val })
                    });
                } catch (err) {
                    console.error("Failed to save project design margin:", err);
                }
            }, 350);
        }

        if (elements.inputProjectDesignMargin) {
            elements.inputProjectDesignMargin.addEventListener("input", (e) => {
                handleMarginChange(e.target.value);
            });
            elements.inputProjectDesignMargin.addEventListener("change", (e) => {
                handleMarginChange(e.target.value);
            });
        }

        if (elements.marginPresetChips) {
            elements.marginPresetChips.addEventListener("click", (e) => {
                const btn = e.target.closest(".btn-margin-chip");
                if (!btn) return;
                const val = parseFloat(btn.dataset.margin);
                if (elements.inputProjectDesignMargin) {
                    elements.inputProjectDesignMargin.value = val;
                }
                handleMarginChange(val);
            });
        }

        // Global click to close combo dropdown
        document.addEventListener("click", (e) => {
            if (elements.prjSearchCombo && !elements.prjSearchCombo.contains(e.target)) {
                closePrjComboDropdown();
            }
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closePrjComboDropdown();
                if (elements.allProjectsModal && !elements.allProjectsModal.classList.contains("hidden")) {
                    closeAllProjectsModal();
                }
                if (elements.editProjectModal && !elements.editProjectModal.classList.contains("hidden")) {
                    closeEditProjectModal();
                }
                if (elements.newProjectModal && !elements.newProjectModal.classList.contains("hidden")) {
                    closeNewProjectModal();
                }
                if (elements.addFittingDialog && !elements.addFittingDialog.classList.contains("hidden")) {
                    closeAddFittingDialog();
                }
                if (elements.projectSummaryModal && !elements.projectSummaryModal.classList.contains("hidden")) {
                    closeProjectSummaryModal();
                }
            }
        });

        [elements.newProjectModal, elements.addFittingDialog, elements.projectSummaryModal, elements.allProjectsModal, elements.editProjectModal].forEach(m => {
            if (m) {
                m.addEventListener("click", (e) => {
                    if (e.target === m) {
                        m.classList.add("hidden");
                    }
                });
            }
        });
    }


    // Expose selectFitting and setMode for deep-linking & testing
    window.selectFitting = selectFitting;
    window.setMode = setMode;
    window.calculate = calculate;
    window.clearFittingOutputs = clearFittingOutputs;
    window.appState = state;

    // Startup
    document.addEventListener("DOMContentLoaded", init);
})();
