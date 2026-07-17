/**
 * GCM OS — Business Workspace Runtime
 *
 * File: businessWorkspace.js
 * Version: 1.0.0
 *
 * Responsibility:
 * 1. Load a Business Record.
 * 2. Perform runtime validation.
 * 3. Normalize record collections.
 * 4. Derive executive workspace intelligence.
 * 5. Expose a stable public API for GCM OS interfaces.
 *
 * This file does not render HTML or manipulate the DOM.
 * The Business Record remains the single source of truth.
 */

(function initializeBusinessWorkspace(globalScope) {
  "use strict";

  const RUNTIME_VERSION = "1.0.0";
  const SUPPORTED_SCHEMA_VERSION = "1.0.0";
  const DEFAULT_DATA_DIRECTORY = "data";
  const DEFAULT_RECENT_ACTIVITY_DAYS = 14;

  let state = createInitialState();

  /**
   * Public API
   */
  const BusinessWorkspace = Object.freeze({
    version: RUNTIME_VERSION,

    load,
    loadFromObject,
    reset,

    isLoaded,
    getStatus,
    getErrors,
    getWarnings,

    getRecord,
    getBusiness,
    getRelationship,
    getWorkspace,
    getExecutive,

    getPriorities,
    getWorkQueue,
    getCurrentWork,
    getToday,
    getThisWeek,
    getOverdue,
    getWaitingOn,
    getAlerts,
    getNextBestAction,
    getRecentActivity,

    getAdvertising,
    getSEO,
    getWebsite,
    getSocial,
    getProofOfWork,
    getMetrics,
    getResults,
    getGrowthReviews,
    getCaseStudy,
    getDocuments,
    getHistory,

    findWorkItem,
    findProofOfWorkEntry,
    findMetric,
    findResult,

    refresh
  });

  /**
   * Load a Business Record from its business ID.
   *
   * Example:
   * await BusinessWorkspace.load("southeast-safes");
   *
   * Default path:
   * data/southeast-safes.json
   */
  async function load(businessId, options = {}) {
    const normalizedBusinessId = normalizeBusinessId(businessId);

    if (!normalizedBusinessId) {
      throw createWorkspaceError(
        "INVALID_BUSINESS_ID",
        "A valid business ID is required."
      );
    }

    const dataDirectory = normalizeDirectory(
      options.dataDirectory || DEFAULT_DATA_DIRECTORY
    );

    const recordUrl =
      options.recordUrl ||
      `${dataDirectory}/${encodeURIComponent(normalizedBusinessId)}.json`;

    state = {
      ...createInitialState(),
      status: "loading",
      requestedBusinessId: normalizedBusinessId,
      recordUrl
    };

    try {
      const response = await fetch(recordUrl, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: options.cache || "no-store"
      });

      if (!response.ok) {
        throw createWorkspaceError(
          "BUSINESS_RECORD_LOAD_FAILED",
          `Unable to load Business Record "${normalizedBusinessId}". HTTP ${response.status}.`,
          {
            businessId: normalizedBusinessId,
            recordUrl,
            httpStatus: response.status
          }
        );
      }

      let record;

      try {
        record = await response.json();
      } catch (error) {
        throw createWorkspaceError(
          "INVALID_JSON",
          `The Business Record "${normalizedBusinessId}" is not valid JSON.`,
          {
            businessId: normalizedBusinessId,
            recordUrl,
            cause: error
          }
        );
      }

      return loadFromObject(record, {
        requestedBusinessId: normalizedBusinessId,
        recordUrl
      });
    } catch (error) {
      const workspaceError = normalizeError(error);

      state = {
        ...state,
        status: "error",
        loadedAt: null,
        errors: [serializeError(workspaceError)]
      };

      throw workspaceError;
    }
  }

  /**
   * Load a Business Record that has already been parsed.
   *
   * Useful for tests, Worker responses, local data, and future storage layers.
   */
  function loadFromObject(record, options = {}) {
    const copiedRecord = deepClone(record);
    const validation = validateBusinessRecord(copiedRecord);

    if (!validation.valid) {
      const error = createWorkspaceError(
        "BUSINESS_RECORD_VALIDATION_FAILED",
        "The Business Record failed runtime validation.",
        {
          validationErrors: validation.errors
        }
      );

      state = {
        ...createInitialState(),
        status: "error",
        requestedBusinessId: options.requestedBusinessId || null,
        recordUrl: options.recordUrl || null,
        errors: validation.errors,
        warnings: validation.warnings
      };

      throw error;
    }

    const normalizedRecord = normalizeRecord(copiedRecord);
    const executive = computeExecutiveWorkspace(normalizedRecord);

    state = {
      status: "ready",
      requestedBusinessId:
        options.requestedBusinessId || normalizedRecord.businessId,
      recordUrl: options.recordUrl || null,
      record: normalizedRecord,
      executive,
      errors: [],
      warnings: validation.warnings,
      loadedAt: new Date().toISOString()
    };

    return getWorkspaceSnapshot();
  }

  /**
   * Recompute executive intelligence from the currently loaded record.
   */
  function refresh() {
    assertRecordLoaded();

    state = {
      ...state,
      executive: computeExecutiveWorkspace(state.record),
      loadedAt: new Date().toISOString()
    };

    return getWorkspaceSnapshot();
  }

  function reset() {
    state = createInitialState();
  }

  function isLoaded() {
    return state.status === "ready" && Boolean(state.record);
  }

  function getStatus() {
    return state.status;
  }

  function getErrors() {
    return deepClone(state.errors);
  }

  function getWarnings() {
    return deepClone(state.warnings);
  }

  function getRecord() {
    assertRecordLoaded();
    return deepClone(state.record);
  }

  function getBusiness() {
    assertRecordLoaded();
    return deepClone(state.record.business);
  }

  function getRelationship() {
    assertRecordLoaded();
    return deepClone(state.record.relationship);
  }

  /**
   * Returns the complete runtime workspace.
   *
   * This includes:
   * - Business Record
   * - Derived executive intelligence
   * - Runtime metadata
   */
  function getWorkspace() {
    assertRecordLoaded();
    return getWorkspaceSnapshot();
  }

  function getExecutive() {
    assertRecordLoaded();
    return deepClone(state.executive);
  }

  function getPriorities(options = {}) {
    assertRecordLoaded();

    let priorities = [...state.executive.priorities];

    if (options.status) {
      priorities = priorities.filter(
        (item) => normalizeText(item.status) === normalizeText(options.status)
      );
    }

    if (options.priority) {
      priorities = priorities.filter(
        (item) =>
          normalizeText(item.priority) === normalizeText(options.priority)
      );
    }

    return deepClone(priorities);
  }

  function getWorkQueue(options = {}) {
    assertRecordLoaded();

    let items = [...state.record.workQueue];

    if (options.status) {
      items = items.filter(
        (item) => normalizeText(item.status) === normalizeText(options.status)
      );
    }

    if (options.category) {
      items = items.filter(
        (item) =>
          normalizeText(item.category) === normalizeText(options.category)
      );
    }

    if (options.priority) {
      items = items.filter(
        (item) =>
          normalizeText(item.priority) === normalizeText(options.priority)
      );
    }

    if (options.owner) {
      items = items.filter(
        (item) => normalizeText(item.owner) === normalizeText(options.owner)
      );
    }

    return deepClone(sortWorkItems(items));
  }

  function getCurrentWork() {
    assertRecordLoaded();
    return deepClone(state.executive.currentWork);
  }

  function getToday() {
    assertRecordLoaded();
    return deepClone(state.executive.today);
  }

  function getThisWeek() {
    assertRecordLoaded();
    return deepClone(state.executive.thisWeek);
  }

  function getOverdue() {
    assertRecordLoaded();
    return deepClone(state.executive.overdue);
  }

  function getWaitingOn() {
    assertRecordLoaded();
    return deepClone(state.executive.waitingOn);
  }

  function getAlerts() {
    assertRecordLoaded();
    return deepClone(state.executive.alerts);
  }

  function getNextBestAction() {
    assertRecordLoaded();
    return deepClone(state.executive.nextBestAction);
  }

  function getRecentActivity(options = {}) {
    assertRecordLoaded();

    const limit = toPositiveInteger(options.limit, null);
    const days = toPositiveInteger(
      options.days,
      DEFAULT_RECENT_ACTIVITY_DAYS
    );

    let activity = computeRecentActivity(state.record, days);

    if (limit) {
      activity = activity.slice(0, limit);
    }

    return deepClone(activity);
  }

  function getAdvertising() {
    assertRecordLoaded();
    return deepClone(state.record.advertising);
  }

  function getSEO() {
    assertRecordLoaded();
    return deepClone(state.record.seo);
  }

  function getWebsite() {
    assertRecordLoaded();
    return deepClone(state.record.website);
  }

  function getSocial() {
    assertRecordLoaded();
    return deepClone(state.record.socialMedia);
  }

  function getProofOfWork(options = {}) {
    assertRecordLoaded();

    let entries = [...state.record.proofOfWork];

    if (options.status) {
      entries = entries.filter(
        (entry) =>
          normalizeText(entry.status) === normalizeText(options.status)
      );
    }

    if (options.category) {
      entries = entries.filter(
        (entry) =>
          normalizeText(entry.category) === normalizeText(options.category)
      );
    }

    if (typeof options.caseStudyEligible === "boolean") {
      entries = entries.filter(
        (entry) =>
          entry.caseStudyEligible === options.caseStudyEligible
      );
    }

    if (typeof options.revenuePath === "boolean") {
      entries = entries.filter(
        (entry) => entry.revenuePath === options.revenuePath
      );
    }

    return deepClone(sortByDateDescending(entries, "date"));
  }

  function getMetrics(options = {}) {
    assertRecordLoaded();

    let metrics = [...state.record.metrics];

    if (options.category) {
      metrics = metrics.filter(
        (metric) =>
          normalizeText(metric.category) === normalizeText(options.category)
      );
    }

    if (options.metric) {
      metrics = metrics.filter(
        (metric) =>
          normalizeText(metric.metric) === normalizeText(options.metric)
      );
    }

    return deepClone(sortByDateDescending(metrics, "date"));
  }

  function getResults(options = {}) {
    assertRecordLoaded();

    let results = [...state.record.results];

    if (options.category) {
      results = results.filter(
        (result) =>
          normalizeText(result.category) === normalizeText(options.category)
      );
    }

    if (typeof options.verified === "boolean") {
      results = results.filter(
        (result) => result.verified === options.verified
      );
    }

    return deepClone(sortByDateDescending(results, "date"));
  }

  function getGrowthReviews() {
    assertRecordLoaded();
    return deepClone(state.record.growthReviews);
  }

  function getCaseStudy() {
    assertRecordLoaded();
    return deepClone(state.record.caseStudy);
  }

  function getDocuments() {
    assertRecordLoaded();
    return deepClone(
      sortByDateDescending(state.record.documents, "createdDate")
    );
  }

  function getHistory(options = {}) {
    assertRecordLoaded();

    let history = [...state.record.history];

    if (options.type) {
      history = history.filter(
        (entry) => normalizeText(entry.type) === normalizeText(options.type)
      );
    }

    if (options.category) {
      history = history.filter(
        (entry) =>
          normalizeText(entry.category) === normalizeText(options.category)
      );
    }

    const limit = toPositiveInteger(options.limit, null);

    history = sortHistoryEntries(history);

    if (limit) {
      history = history.slice(0, limit);
    }

    return deepClone(history);
  }

  function findWorkItem(id) {
    assertRecordLoaded();
    return findById(state.record.workQueue, id);
  }

  function findProofOfWorkEntry(id) {
    assertRecordLoaded();
    return findById(state.record.proofOfWork, id);
  }

  function findMetric(id) {
    assertRecordLoaded();
    return findById(state.record.metrics, id);
  }

  function findResult(id) {
    assertRecordLoaded();
    return findById(state.record.results, id);
  }

  /**
   * Executive workspace
   */
  function computeExecutiveWorkspace(record) {
    const overdue = computeOverdue(record);
    const today = computeToday(record);
    const thisWeek = computeThisWeek(record);
    const waitingOn = computeWaitingOn(record);
    const currentWork = computeCurrentWork(record);
    const priorities = computePriorities(record);
    const recentActivity = computeRecentActivity(
      record,
      DEFAULT_RECENT_ACTIVITY_DAYS
    );
    const alerts = computeAlerts(record, {
      overdue,
      waitingOn
    });
    const nextBestAction = computeNextBestAction(record, {
      overdue,
      today,
      thisWeek,
      currentWork,
      priorities,
      alerts
    });

    return {
      generatedAt: new Date().toISOString(),
      alerts,
      priorities,
      nextBestAction,
      waitingOn,
      recentActivity,
      currentWork,
      today,
      thisWeek,
      overdue,
      summary: computeExecutiveSummary(record, {
        alerts,
        currentWork,
        overdue,
        waitingOn,
        recentActivity
      })
    };
  }

  function computePriorities(record) {
    const priorities = [...record.currentPriorities];

    return priorities.sort((a, b) => {
      const priorityDifference =
        priorityRank(a.priority) - priorityRank(b.priority);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const statusDifference = statusRank(a.status) - statusRank(b.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return compareDatesAscending(a.dueDate, b.dueDate);
    });
  }

  function computeCurrentWork(record) {
    const activeStatuses = new Set([
      "planned",
      "in progress",
      "waiting",
      "blocked"
    ]);

    return sortWorkItems(
      record.workQueue.filter((item) =>
        activeStatuses.has(normalizeText(item.status))
      )
    );
  }

  function computeToday(record) {
    const today = startOfDay(new Date());

    return sortWorkItems(
      record.workQueue.filter((item) => {
        if (isClosedWorkItem(item)) {
          return false;
        }

        const dueDate = parseDate(item.dueDate);

        return dueDate ? isSameDay(dueDate, today) : false;
      })
    );
  }

  function computeThisWeek(record) {
    const today = startOfDay(new Date());
    const weekEnd = endOfWeek(today);

    return sortWorkItems(
      record.workQueue.filter((item) => {
        if (isClosedWorkItem(item)) {
          return false;
        }

        const dueDate = parseDate(item.dueDate);

        if (!dueDate) {
          return false;
        }

        return dueDate >= today && dueDate <= weekEnd;
      })
    );
  }

  function computeOverdue(record) {
    const today = startOfDay(new Date());

    return sortWorkItems(
      record.workQueue.filter((item) => {
        if (isClosedWorkItem(item)) {
          return false;
        }

        const dueDate = parseDate(item.dueDate);

        return dueDate ? dueDate < today : false;
      })
    );
  }

  function computeWaitingOn(record) {
    const waitingStatuses = new Set(["waiting", "blocked"]);

    return sortWorkItems(
      record.workQueue.filter((item) =>
        waitingStatuses.has(normalizeText(item.status))
      )
    );
  }

  function computeRecentActivity(record, days) {
    const cutoffDate = startOfDay(new Date());
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const historyActivity = record.history.map((entry) => ({
      id: entry.id,
      date: entry.date,
      time: entry.time,
      type: entry.type,
      category: entry.category,
      title: entry.title,
      description: entry.description,
      sourceId: entry.sourceId,
      createdBy: entry.createdBy,
      activitySource: "history"
    }));

    const proofActivity = record.proofOfWork
      .filter((entry) => normalizeText(entry.status) === "complete")
      .map((entry) => ({
        id: entry.id,
        date: entry.date,
        time: null,
        type: "Proof of Work",
        category: entry.category,
        title: entry.task,
        description: entry.result || entry.businessValue,
        sourceId: entry.id,
        createdBy: "Global Concepts Media",
        activitySource: "proofOfWork"
      }));

    const resultActivity = record.results.map((result) => ({
      id: result.id,
      date: result.date,
      time: null,
      type: "Result",
      category: result.category,
      title: result.title,
      description: result.measuredImpact || result.description,
      sourceId: result.id,
      createdBy: "Global Concepts Media",
      activitySource: "results"
    }));

    const activity = [
      ...historyActivity,
      ...proofActivity,
      ...resultActivity
    ]
      .filter((entry) => {
        const entryDate = parseDate(entry.date);
        return entryDate ? entryDate >= cutoffDate : false;
      })
      .filter(removeDuplicateActivity);

    return sortHistoryEntries(activity);
  }

  function computeAlerts(record, context) {
    const alerts = [];

    context.overdue.forEach((item) => {
      alerts.push({
        id: `alert-overdue-${item.id}`,
        level:
          normalizeText(item.priority) === "critical" ? "Critical" : "High",
        category: "Work",
        title: "Overdue work item",
        message: `"${item.title}" is overdue.`,
        sourceId: item.id,
        action: item.nextAction || "Review and reschedule this work item."
      });
    });

    context.waitingOn.forEach((item) => {
      alerts.push({
        id: `alert-waiting-${item.id}`,
        level:
          normalizeText(item.status) === "blocked" ? "High" : "Medium",
        category: "Work",
        title:
          normalizeText(item.status) === "blocked"
            ? "Work item blocked"
            : "Work item waiting",
        message: `"${item.title}" is currently ${item.status.toLowerCase()}.`,
        sourceId: item.id,
        action: item.nextAction || "Identify what is required to continue."
      });
    });

    if (
      ["needs review", "partially active"].includes(
        normalizeText(record.advertising.currentStatus)
      )
    ) {
      alerts.push({
        id: "alert-advertising-status",
        level: "High",
        category: "Advertising",
        title: "Advertising requires review",
        message: `Advertising status is "${record.advertising.currentStatus}".`,
        sourceId: null,
        action:
          firstNonEmpty(
            record.advertising.campaigns.map(
              (campaign) => campaign.nextOptimization
            )
          ) || "Review active advertising campaigns."
      });
    }

    record.advertising.campaigns.forEach((campaign) => {
      if (
        ["needs review", "draft"].includes(normalizeText(campaign.status))
      ) {
        alerts.push({
          id: `alert-campaign-${campaign.id}`,
          level:
            normalizeText(campaign.status) === "needs review"
              ? "High"
              : "Medium",
          category: "Advertising",
          title: `Campaign ${campaign.status.toLowerCase()}`,
          message: `"${campaign.campaignName}" is marked ${campaign.status}.`,
          sourceId: campaign.id,
          action:
            campaign.nextOptimization ||
            "Review the campaign and define its next action."
        });
      }
    });

    if (normalizeText(record.seo.status) === "needs review") {
      alerts.push({
        id: "alert-seo-review",
        level: "Medium",
        category: "SEO",
        title: "SEO requires review",
        message: "Current SEO performance has not been fully verified.",
        sourceId: null,
        action: record.seo.nextAction || "Review current SEO performance."
      });
    }

    if (normalizeText(record.socialMedia.status) === "needs review") {
      alerts.push({
        id: "alert-social-review",
        level: "Medium",
        category: "Social Media",
        title: "Social media requires review",
        message:
          "Current social profiles, activity, and performance require verification.",
        sourceId: null,
        action:
          record.socialMedia.nextAction ||
          "Review current social media activity."
      });
    }

    record.growthReviews.forEach((review) => {
      review.recommendations.forEach((recommendation) => {
        const isApproved =
          normalizeText(recommendation.status) === "approved";
        const hasWorkItem = Boolean(recommendation.convertedWorkItemId);

        if (isApproved && !hasWorkItem) {
          alerts.push({
            id: `alert-review-recommendation-${recommendation.id}`,
            level: "High",
            category: "Growth Review",
            title: "Approved recommendation not scheduled",
            message: `"${recommendation.title}" is approved but has not been converted into a work item.`,
            sourceId: recommendation.id,
            action: "Create and schedule a work item."
          });
        }
      });
    });

    if (
      record.relationship.accountHealth === "Needs Attention" ||
      record.relationship.accountHealth === "At Risk"
    ) {
      alerts.push({
        id: "alert-account-health",
        level:
          record.relationship.accountHealth === "At Risk"
            ? "Critical"
            : "High",
        category: "Account",
        title: `Account health: ${record.relationship.accountHealth}`,
        message:
          record.relationship.accountHealthReason ||
          "The account requires attention.",
        sourceId: null,
        action:
          record.workspace.nextAction ||
          "Review the account and define the immediate next action."
      });
    }

    return alerts.sort((a, b) => alertRank(a.level) - alertRank(b.level));
  }

  function computeNextBestAction(record, context) {
    const criticalOverdue = context.overdue.find(
      (item) => normalizeText(item.priority) === "critical"
    );

    if (criticalOverdue) {
      return createNextAction(
        criticalOverdue.nextAction || criticalOverdue.title,
        "A critical work item is overdue.",
        "Critical",
        "Work",
        criticalOverdue.id
      );
    }

    const criticalAlert = context.alerts.find(
      (alert) => alert.level === "Critical"
    );

    if (criticalAlert) {
      return createNextAction(
        criticalAlert.action,
        criticalAlert.message,
        "Critical",
        criticalAlert.category,
        criticalAlert.sourceId
      );
    }

    const criticalCurrentWork = context.currentWork.find(
      (item) => normalizeText(item.priority) === "critical"
    );

    if (criticalCurrentWork) {
      return createNextAction(
        criticalCurrentWork.nextAction || criticalCurrentWork.title,
        criticalCurrentWork.businessValue ||
          "This is the highest-priority active work item.",
        "Critical",
        criticalCurrentWork.category,
        criticalCurrentWork.id
      );
    }

    const criticalPriority = context.priorities.find(
      (item) =>
        normalizeText(item.priority) === "critical" &&
        !isClosedPriority(item)
    );

    if (criticalPriority) {
      return createNextAction(
        criticalPriority.nextAction || criticalPriority.title,
        criticalPriority.businessValue ||
          "This is the highest-priority business objective.",
        "Critical",
        criticalPriority.category,
        criticalPriority.id
      );
    }

    if (context.today.length > 0) {
      const item = context.today[0];

      return createNextAction(
        item.nextAction || item.title,
        "This work item is due today.",
        item.priority,
        item.category,
        item.id
      );
    }

    const highAlert = context.alerts.find(
      (alert) => alert.level === "High"
    );

    if (highAlert) {
      return createNextAction(
        highAlert.action,
        highAlert.message,
        "High",
        highAlert.category,
        highAlert.sourceId
      );
    }

    if (record.workspace.nextAction) {
      return createNextAction(
        record.workspace.nextAction,
        record.workspace.nextActionReason ||
          "This is the next action stored in the Business Record.",
        "High",
        "Workspace",
        null
      );
    }

    const nextWorkItem = context.currentWork[0];

    if (nextWorkItem) {
      return createNextAction(
        nextWorkItem.nextAction || nextWorkItem.title,
        nextWorkItem.businessValue ||
          "This is the highest-ranked active work item.",
        nextWorkItem.priority,
        nextWorkItem.category,
        nextWorkItem.id
      );
    }

    return createNextAction(
      "Review the Business Record and create the next work item.",
      "No actionable work is currently scheduled.",
      "Medium",
      "Planning",
      null
    );
  }

  function computeExecutiveSummary(record, context) {
    return {
      businessName: record.business.name,
      recordType: record.relationship.recordType,
      relationshipStatus: record.relationship.status,
      stage: record.relationship.stage,
      accountHealth: record.relationship.accountHealth,
      currentPriority: record.workspace.currentPriority,
      openWorkItems: context.currentWork.length,
      overdueWorkItems: context.overdue.length,
      waitingWorkItems: context.waitingOn.length,
      activeAlerts: context.alerts.length,
      recentActivityCount: context.recentActivity.length,
      proofOfWorkCount: record.proofOfWork.length,
      verifiedResultsCount: record.results.filter(
        (result) => result.verified === true
      ).length,
      caseStudyStatus: record.caseStudy.status
    };
  }

  /**
   * Runtime validation
   *
   * This is intentionally lightweight and dependency-free.
   * The JSON Schema remains the canonical validation contract.
   */
  function validateBusinessRecord(record) {
    const errors = [];
    const warnings = [];

    if (!isPlainObject(record)) {
      return {
        valid: false,
        errors: [
          createValidationMessage(
            "record",
            "Business Record must be a JSON object."
          )
        ],
        warnings
      };
    }

    requireString(record, "schemaVersion", errors);
    requireString(record, "businessId", errors);
    requireObject(record, "business", errors);
    requireObject(record, "relationship", errors);
    requireObject(record, "workspace", errors);
    requireArray(record, "currentPriorities", errors);
    requireArray(record, "workQueue", errors);
    requireObject(record, "advertising", errors);
    requireObject(record, "seo", errors);
    requireObject(record, "website", errors);
    requireObject(record, "socialMedia", errors);
    requireArray(record, "proofOfWork", errors);
    requireArray(record, "metrics", errors);
    requireArray(record, "results", errors);
    requireArray(record, "growthReviews", errors);
    requireObject(record, "caseStudy", errors);
    requireArray(record, "documents", errors);
    requireArray(record, "history", errors);
    requireObject(record, "metadata", errors);

    if (
      typeof record.schemaVersion === "string" &&
      record.schemaVersion !== SUPPORTED_SCHEMA_VERSION
    ) {
      errors.push(
        createValidationMessage(
          "schemaVersion",
          `Unsupported schema version "${record.schemaVersion}". Expected "${SUPPORTED_SCHEMA_VERSION}".`
        )
      );
    }

    if (
      typeof record.businessId === "string" &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.businessId)
    ) {
      errors.push(
        createValidationMessage(
          "businessId",
          "Business ID must be a lowercase slug."
        )
      );
    }

    if (isPlainObject(record.business)) {
      requireString(record.business, "name", errors, "business.name");
      requireString(
        record.business,
        "industry",
        errors,
        "business.industry"
      );
    }

    if (isPlainObject(record.relationship)) {
      requireString(
        record.relationship,
        "recordType",
        errors,
        "relationship.recordType"
      );
      requireString(
        record.relationship,
        "status",
        errors,
        "relationship.status"
      );
      requireString(
        record.relationship,
        "stage",
        errors,
        "relationship.stage"
      );
    }

    if (isPlainObject(record.workspace)) {
      requireString(
        record.workspace,
        "owner",
        errors,
        "workspace.owner"
      );
    }

    validateUniqueIds(record, errors, warnings);
    validateReferences(record, warnings);
    validateDates(record, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  function validateUniqueIds(record, errors) {
    const collections = [
      ["currentPriorities", record.currentPriorities],
      ["workQueue", record.workQueue],
      ["proofOfWork", record.proofOfWork],
      ["metrics", record.metrics],
      ["results", record.results],
      ["growthReviews", record.growthReviews],
      ["documents", record.documents],
      ["history", record.history],
      [
        "advertising.campaigns",
        record.advertising && record.advertising.campaigns
      ],
      ["website.changes", record.website && record.website.changes],
      [
        "socialMedia.content",
        record.socialMedia && record.socialMedia.content
      ]
    ];

    collections.forEach(([path, collection]) => {
      if (!Array.isArray(collection)) {
        return;
      }

      const seen = new Set();

      collection.forEach((item, index) => {
        if (!isPlainObject(item) || !item.id) {
          errors.push(
            createValidationMessage(
              `${path}[${index}].id`,
              "A unique ID is required."
            )
          );
          return;
        }

        if (seen.has(item.id)) {
          errors.push(
            createValidationMessage(
              `${path}[${index}].id`,
              `Duplicate ID "${item.id}".`
            )
          );
        }

        seen.add(item.id);
      });
    });
  }

  function validateReferences(record, warnings) {
    if (
      !Array.isArray(record.workQueue) ||
      !Array.isArray(record.proofOfWork)
    ) {
      return;
    }

    const workItemIds = new Set(
      record.workQueue.map((item) => item.id).filter(Boolean)
    );
    const proofIds = new Set(
      record.proofOfWork.map((entry) => entry.id).filter(Boolean)
    );

    record.workQueue.forEach((item, index) => {
      if (item.proofOfWorkId && !proofIds.has(item.proofOfWorkId)) {
        warnings.push(
          createValidationMessage(
            `workQueue[${index}].proofOfWorkId`,
            `Referenced Proof of Work ID "${item.proofOfWorkId}" was not found.`
          )
        );
      }
    });

    record.proofOfWork.forEach((entry, index) => {
      if (
        entry.sourceWorkItemId &&
        !workItemIds.has(entry.sourceWorkItemId)
      ) {
        warnings.push(
          createValidationMessage(
            `proofOfWork[${index}].sourceWorkItemId`,
            `Referenced work item ID "${entry.sourceWorkItemId}" was not found.`
          )
        );
      }
    });
  }

  function validateDates(record, warnings) {
    const dateChecks = [
      ["relationship.clientSince", record.relationship?.clientSince],
      ["relationship.clientEnded", record.relationship?.clientEnded],
      ["workspace.nextReviewDate", record.workspace?.nextReviewDate],
      ["workspace.lastClientContact", record.workspace?.lastClientContact],
      ["workspace.lastWorkDate", record.workspace?.lastWorkDate],
      ["metadata.createdAt", record.metadata?.createdAt],
      ["metadata.updatedAt", record.metadata?.updatedAt]
    ];

    dateChecks.forEach(([path, value]) => {
      if (value && !parseDate(value)) {
        warnings.push(
          createValidationMessage(path, `Invalid date value "${value}".`)
        );
      }
    });
  }

  /**
   * Normalization
   */
  function normalizeRecord(record) {
    return {
      ...record,
      currentPriorities: normalizeArray(record.currentPriorities),
      workQueue: normalizeArray(record.workQueue),
      proofOfWork: normalizeArray(record.proofOfWork),
      metrics: normalizeArray(record.metrics),
      results: normalizeArray(record.results),
      growthReviews: normalizeArray(record.growthReviews).map((review) => ({
        ...review,
        recommendations: normalizeArray(review.recommendations)
      })),
      documents: normalizeArray(record.documents),
      history: normalizeArray(record.history),
      advertising: {
        ...record.advertising,
        campaigns: normalizeArray(record.advertising?.campaigns)
      },
      seo: {
        ...record.seo,
        records: normalizeArray(record.seo?.records)
      },
      website: {
        ...record.website,
        changes: normalizeArray(record.website?.changes)
      },
      socialMedia: {
        ...record.socialMedia,
        channels: normalizeArray(record.socialMedia?.channels),
        content: normalizeArray(record.socialMedia?.content)
      },
      caseStudy: {
        ...record.caseStudy,
        workCompleted: normalizeArray(record.caseStudy?.workCompleted),
        measuredResults: normalizeArray(
          record.caseStudy?.measuredResults
        ),
        proofOfWorkIds: normalizeArray(
          record.caseStudy?.proofOfWorkIds
        ),
        resultIds: normalizeArray(record.caseStudy?.resultIds)
      }
    };
  }

  /**
   * Utility functions
   */
  function createInitialState() {
    return {
      status: "idle",
      requestedBusinessId: null,
      recordUrl: null,
      record: null,
      executive: null,
      errors: [],
      warnings: [],
      loadedAt: null
    };
  }

  function getWorkspaceSnapshot() {
    return deepClone({
      runtimeVersion: RUNTIME_VERSION,
      status: state.status,
      requestedBusinessId: state.requestedBusinessId,
      recordUrl: state.recordUrl,
      loadedAt: state.loadedAt,
      warnings: state.warnings,
      record: state.record,
      executive: state.executive
    });
  }

  function assertRecordLoaded() {
    if (!isLoaded()) {
      throw createWorkspaceError(
        "BUSINESS_RECORD_NOT_LOADED",
        "Load a Business Record before requesting workspace data."
      );
    }
  }

  function normalizeBusinessId(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeDirectory(value) {
    return String(value || DEFAULT_DATA_DIRECTORY).replace(/\/+$/g, "");
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function requireString(object, property, errors, path = property) {
    if (
      !Object.prototype.hasOwnProperty.call(object, property) ||
      typeof object[property] !== "string" ||
      object[property].trim() === ""
    ) {
      errors.push(
        createValidationMessage(path, "A non-empty string is required.")
      );
    }
  }

  function requireObject(object, property, errors, path = property) {
    if (!isPlainObject(object[property])) {
      errors.push(
        createValidationMessage(path, "A JSON object is required.")
      );
    }
  }

  function requireArray(object, property, errors, path = property) {
    if (!Array.isArray(object[property])) {
      errors.push(
        createValidationMessage(path, "An array is required.")
      );
    }
  }

  function createValidationMessage(path, message) {
    return {
      path,
      message
    };
  }

  function createWorkspaceError(code, message, details = {}) {
    const error = new Error(message);
    error.name = "BusinessWorkspaceError";
    error.code = code;
    error.details = details;
    return error;
  }

  function normalizeError(error) {
    if (error?.name === "BusinessWorkspaceError") {
      return error;
    }

    return createWorkspaceError(
      "UNEXPECTED_WORKSPACE_ERROR",
      error?.message || "An unexpected Business Workspace error occurred.",
      {
        cause: error
      }
    );
  }

  function serializeError(error) {
    return {
      name: error.name || "Error",
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "Unknown error",
      details: error.details || {}
    };
  }

  function deepClone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : startOfDay(new Date(value));
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      const date = new Date(year, month, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
      ) {
        return null;
      }

      return startOfDay(date);
    }

    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function endOfWeek(date) {
    const result = startOfDay(date);
    const currentDay = result.getDay();
    const daysUntilSunday = 7 - currentDay;

    result.setDate(result.getDate() + daysUntilSunday);
    result.setHours(23, 59, 59, 999);

    return result;
  }

  function isSameDay(firstDate, secondDate) {
    return (
      firstDate.getFullYear() === secondDate.getFullYear() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getDate() === secondDate.getDate()
    );
  }

  function compareDatesAscending(firstValue, secondValue) {
    const firstDate = parseDate(firstValue);
    const secondDate = parseDate(secondValue);

    if (!firstDate && !secondDate) {
      return 0;
    }

    if (!firstDate) {
      return 1;
    }

    if (!secondDate) {
      return -1;
    }

    return firstDate.getTime() - secondDate.getTime();
  }

  function sortByDateDescending(items, property) {
    return [...items].sort((a, b) => {
      const firstDate = parseDate(a[property]);
      const secondDate = parseDate(b[property]);

      if (!firstDate && !secondDate) {
        return 0;
      }

      if (!firstDate) {
        return 1;
      }

      if (!secondDate) {
        return -1;
      }

      return secondDate.getTime() - firstDate.getTime();
    });
  }

  function sortHistoryEntries(items) {
    return [...items].sort((a, b) => {
      const firstTimestamp = createActivityTimestamp(a);
      const secondTimestamp = createActivityTimestamp(b);

      return secondTimestamp - firstTimestamp;
    });
  }

  function createActivityTimestamp(entry) {
    const dateText = entry.date || "";
    const timeText = entry.time || "00:00:00";
    const timestamp = new Date(`${dateText}T${timeText}`).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }

    const fallback = parseDate(dateText);
    return fallback ? fallback.getTime() : 0;
  }

  function sortWorkItems(items) {
    return [...items].sort((a, b) => {
      const priorityDifference =
        priorityRank(a.priority) - priorityRank(b.priority);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const statusDifference = statusRank(a.status) - statusRank(b.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return compareDatesAscending(a.dueDate, b.dueDate);
    });
  }

  function priorityRank(priority) {
    const ranks = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    return ranks[normalizeText(priority)] ?? 99;
  }

  function statusRank(status) {
    const ranks = {
      blocked: 0,
      "in progress": 1,
      waiting: 2,
      planned: 3,
      backlog: 4,
      "not started": 5,
      deferred: 6,
      complete: 7
    };

    return ranks[normalizeText(status)] ?? 99;
  }

  function alertRank(level) {
    const ranks = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3
    };

    return ranks[level] ?? 99;
  }

  function isClosedWorkItem(item) {
    return ["complete", "deferred"].includes(normalizeText(item.status));
  }

  function isClosedPriority(item) {
    return ["complete", "deferred"].includes(normalizeText(item.status));
  }

  function createNextAction(
    action,
    reason,
    priority,
    category,
    sourceId
  ) {
    return {
      action,
      reason,
      priority: priority || "Medium",
      category: category || "General",
      sourceId: sourceId || null
    };
  }

  function firstNonEmpty(values) {
    return values.find(
      (value) => typeof value === "string" && value.trim() !== ""
    );
  }

  function removeDuplicateActivity(entry, index, collection) {
    return (
      collection.findIndex(
        (candidate) =>
          candidate.id === entry.id &&
          candidate.activitySource === entry.activitySource
      ) === index
    );
  }

  function findById(collection, id) {
    const normalizedId = String(id || "").trim();

    if (!normalizedId) {
      return null;
    }

    const item = collection.find(
      (candidate) => candidate.id === normalizedId
    );

    return item ? deepClone(item) : null;
  }

  function toPositiveInteger(value, fallback) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
      return fallback;
    }

    return number;
  }

  /**
   * Make the runtime available to browser pages.
   */
  globalScope.BusinessWorkspace = BusinessWorkspace;
})(typeof window !== "undefined" ? window : globalThis);
