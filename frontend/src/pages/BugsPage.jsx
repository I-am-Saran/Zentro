// src/pages/BugsPage.jsx
import { useEffect, useState, useMemo } from "react";
import { Card, CardBody, Typography, Input } from "@material-tailwind/react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../hooks/useAuth";
import FormField from "../components/FormField";
import SearchableSelect from "../components/SearchableSelect";
import { Eye, Edit } from "lucide-react";

/* ---------- BUTTON ---------- */

function PrimaryButton({ children, className = "", ...rest }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-semibold shadow-lg
                  bg-gradient-to-br from-green-700 to-emerald-600 hover:from-green-800 hover:to-emerald-700
                  transition transform active:scale-95 whitespace-nowrap ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- NORMALIZATION HELPERS ---------- */

// normalize rows we receive (handles DB with spaced names or snake_case)
const normalizeBug = (row) => {
  if (!row) return {};

  // 🔹 Parse comments
  let comments = [];
  const rawCommentData =
    row?.["Comments"] ?? row?.comments ?? row?.["Comment"] ?? row?.comment;

  if (Array.isArray(rawCommentData)) {
    comments = rawCommentData;
  } else if (typeof rawCommentData === "string" && rawCommentData.trim()) {
    try {
      const parsed = JSON.parse(rawCommentData);
      if (Array.isArray(parsed)) {
        comments = parsed;
      } else {
        comments = [
          {
            text: String(rawCommentData),
            user:
              row?.["Reporter"] ??
              row?.reporter ??
              row?.["Assignee"] ??
              row?.assignee ??
              "Unknown User",
            timestamp:
              row?.["Changed"] ?? row?.changed ?? new Date().toISOString(),
          },
        ];
      }
    } catch {
      comments = [
        {
          text: String(rawCommentData),
          user:
            row?.["Reporter"] ??
            row?.reporter ??
            row?.["Assignee"] ??
            row?.assignee ??
            "Unknown User",
          timestamp:
            row?.["Changed"] ?? row?.changed ?? new Date().toISOString(),
        },
      ];
    }
  }

  // 🔹 Parse attachments (from DB jsonb "Attachments" or stringified JSON)
  let attachments = [];
  const rawAttachmentData =
    row?.["Attachments"] ??
    row?.attachments ??
    row?.["Attachment"] ??
    row?.attachment;

  if (Array.isArray(rawAttachmentData)) {
    attachments = rawAttachmentData;
  } else if (
    typeof rawAttachmentData === "string" &&
    rawAttachmentData.trim()
  ) {
    try {
      const parsed = JSON.parse(rawAttachmentData);
      if (Array.isArray(parsed)) attachments = parsed;
    } catch {
      attachments = [];
    }
  } else if (rawAttachmentData && typeof rawAttachmentData === "object") {
    // Supabase jsonb -> JS object/array directly
    attachments = rawAttachmentData;
  }

  // 🔹 Description / Comment from DB
  const descriptionFromRow = row?.["Description"] ?? row?.description ?? "";
  const commentField = row?.["Comment"] ?? row?.comment ?? "";

  return {
    "Bug ID": row?.["Bug ID"] ?? row?.bug_id ?? row?.id ?? row?.bugid ?? null,
    Summary:
      row?.["Summary"] ??
      row?.summary ??
      row?.title ??
      row?.["Component"] ??
      row?.component ??
      "",
    Priority: row?.["Priority"] ?? row?.priority ?? row?.severity ?? "",
    Status: row?.["Status"] ?? row?.status ?? "",
    Assignee: row?.["Assignee"] ?? row?.assignee ?? row?.assignee_name ?? "",
    Changed:
      row?.["Changed"] ??
      row?.changed ??
      row?.updated_at ??
      new Date().toISOString(),
    Product:
      row?.["Product"] ?? row?.product ?? row?.["Project"] ?? row?.project ?? "",

    Description: descriptionFromRow,
    Comment: commentField,

    Comments: comments,
    Attachments: attachments,
  };
};

/* Generate next BUG-xxx style ID based on existing bugs */
const generateBugId = (bugs) => {
  const numbers = bugs
    .map((b) => String(b["Bug ID"] || ""))
    .filter((id) => /^BUG-\d+$/.test(id))
    .map((id) => parseInt(id.replace("BUG-", ""), 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a);

  const nextNum = numbers.length > 0 ? numbers[0] + 1 : 1;
  return `BUG-${String(nextNum).padStart(3, "0")}`;
};

// helper to display attachment type label
const getAttachmentTypeLabel = (att) => {
  const name = (att.filename || att.name || "").toLowerCase();
  const url = (att.url || "").toLowerCase();
  const target = name || url;
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(target)) return "Attached image";
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(target)) return "Attached video";
  return "Attached file";
};

/* ---------- BADGE CLASS HELPERS ---------- */

const getPriorityClass = (priority) => {
  switch (priority) {
    case "Critical":
      return "bg-rose-100 text-rose-700";
    case "High":
      return "bg-orange-100 text-orange-700";
    case "Medium":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-green-100 text-green-700";
  }
};

const getStatusClass = (status) => {
  switch (status) {
    case "OPEN":
      return "bg-red-100 text-red-700";
    case "IN PROGRESS":
      return "bg-blue-100 text-blue-700";
    case "RESOLVED":
      return "bg-yellow-100 text-yellow-700";
    case "REOPENED":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-green-100 text-green-700";
  }
};

/* small helper to avoid recreating in useMemo */
const safeLower = (s) => String(s || "").toLowerCase();

/* ---------- SUPABASE HELPERS ---------- */

// we now always use the `bugs` table
const BUG_TABLE_NAME = "bugs";

const sanitizeFileName = (name) => {
  const noSpaces = name.replace(/\s+/g, "_");
  return noSpaces.replace(/[^A-Za-z0-9._-]/g, "_");
};

/**
 * Build payload that matches DB schema:
 * - Comments[] (frontend) -> Comment (JSON string in DB)
 * - Remove Comments key so Supabase doesn't expect "Comments" column
 */
const buildDbPayload = (payload) => {
  const dbPayload = { ...payload };

  if (Array.isArray(payload.Comments)) {
    try {
      dbPayload.Comment = JSON.stringify(payload.Comments);
    } catch {
      dbPayload.Comment = JSON.stringify([]);
    }
  }

  delete dbPayload.Comments;
  return dbPayload;
};

// Build a tree from flat comments list based on 'level'
const buildCommentTree = (flatComments) => {
  const roots = [];
  const levelMap = { "-1": roots };

  flatComments.forEach((c, idx) => {
    // Preserve originalIndex if it exists, otherwise use current index
    const node = {
      ...c,
      originalIndex: c.originalIndex !== undefined ? c.originalIndex : idx,
      children: [],
    };
    const level = c.level || 0;

    // Find parent array (default to roots if hierarchy is broken)
    const parentArray = levelMap[level - 1] || roots;
    parentArray.push(node);

    // This node becomes the parent for the next level
    levelMap[level] = node.children;
  });

  return roots;
};

/* ---------- COMPONENT ---------- */

const ITEMS_PER_PAGE = 8;

export default function BugsPage() {
  const { user } = useAuth();
  const [view, setView] = useState("list"); // list | form | details
  const [bugs, setBugs] = useState([]);
  const [selectedBug, setSelectedBug] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState([]); // selected File objects
  const [uploadedFiles, setUploadedFiles] = useState([]); // returned {filename,url}
  const [isEditing, setIsEditing] = useState(false);

  // which Supabase table we ended up using (always "bugs" now)
  const [bugTable, setBugTable] = useState(BUG_TABLE_NAME);

  // pagination
  const [page, setPage] = useState(1);

  // Product dropdown options (from Supabase transtrackers.projects_products)
  const [productOptions, setProductOptions] = useState([]);

  // loading state for Add Comment on edit page
  const [commentSaving, setCommentSaving] = useState(false);

  // separate draft for the Comment/Description textbox
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const [replyingToIndex, setReplyingToIndex] = useState(null);

  // attachment preview modal
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Handle browser back button for attachment preview
  useEffect(() => {
    if (previewAttachment) {
      // Push a new history entry when preview opens
      window.history.pushState({ preview: true }, "");

      const handlePopState = () => {
        // When back button is clicked, close the preview
        setPreviewAttachment(null);
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [previewAttachment]);

  // Inline reply state
  const [activeReplyBox, setActiveReplyBox] = useState(null); // { type: 'description' } or { type: 'comment', index: number }
  const [replyDraft, setReplyDraft] = useState("");

  // toast notification
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // Helper to show toast
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3000
    );
  };

  /* ---------- DATA LOADERS ---------- */

  // load bugs ONLY from `bugs` table in Supabase
  const fetchBugs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(BUG_TABLE_NAME)
        .select("*")
        .order("Bug ID", { ascending: false }); // use a column that exists

      if (error) {
        console.error("Error fetching bugs from Supabase:", error);
        setBugs([]);
        return;
      }

      setBugTable(BUG_TABLE_NAME);
      setBugs((data || []).map(normalizeBug));
    } catch (err) {
      console.error("Error fetching bugs from Supabase:", err);
      setBugs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch product list from Supabase transtrackers.projects_products
  useEffect(() => {
    const fetchProductOptions = async () => {
      try {
        const { data, error } = await supabase
          .from("transtrackers")
          .select("projects_products");

        if (error) {
          console.error("Error fetching product options from Supabase:", error);
          return;
        }

        const uniqueProducts = Array.from(
          new Set(
            (data || [])
              .map((row) => row.projects_products)
              .filter((v) => v && String(v).trim() !== "")
          )
        ).sort((a, b) => String(a).localeCompare(String(b)));

        setProductOptions(uniqueProducts);
      } catch (err) {
        console.error("Unexpected error fetching product options:", err);
      }
    };

    fetchProductOptions();
  }, []);

  const getCurrentUserName = () => {
    if (!user) return null;
    // 1. Custom Auth (user.full_name)
    if (user.full_name) return user.full_name;
    // 2. Supabase Auth (user.user_metadata.full_name or name)
    if (user.user_metadata) {
      return user.user_metadata.full_name || user.user_metadata.name || user.email;
    }
    // 3. Fallback to email or username
    return user.email || user.username;
  };

  /* ---------- HANDLERS ---------- */

  const handleChange = (key, value) =>
    setForm((p) => ({
      ...p,
      [key]: value,
    }));

  const onFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    const validFiles = selected.filter(
      (file) =>
        file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    if (validFiles.length !== selected.length) {
      showToast("Only images and videos are allowed", "error");
    }

    setFiles(validFiles);
  };

  // Upload attachments directly to Supabase Storage
  const uploadAttachments = async (bugId, filesArray) => {
    if (!filesArray || filesArray.length === 0) return [];
    const uploaded = [];

    for (const file of filesArray) {
      try {
        const safeName = sanitizeFileName(file.name || "file");
        const path = `bug-attachments/${bugId}_${Date.now()}_${safeName}`;

        const { data, error } = await supabase.storage
          .from("bug-attachments")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
          });

        if (error) {
          console.error("Upload error:", error);
          continue;
        }

        const { data: publicData } = supabase.storage
          .from("bug-attachments")
          .getPublicUrl(path);

        const url =
          publicData?.publicUrl || publicData?.publicURL || publicData?.signedUrl;

        uploaded.push({
          filename: safeName,
          url,
          path,
        });
      } catch (err) {
        console.error("Attachment upload error:", err);
      }
    }

    return uploaded;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const bugId =
      isEditing && form["Bug ID"] ? form["Bug ID"] : generateBugId(bugs);

    const description = editCommentDraft.trim();

    const payloadBase = {
      ...form,
      "Bug ID": bugId,
      Status: isEditing ? form["Status"] || "OPEN" : "OPEN",
      Changed: new Date().toISOString(),
      Comments: form.Comments || [],
      Attachments: form.Attachments || [],
    };

    // VALIDATION: Summary is mandatory (Create & Edit)
    if (!payloadBase.Summary || !payloadBase.Summary.trim()) {
      showToast("Summary is required", "error");
      setLoading(false);
      return;
    }

    // VALIDATION: Description is mandatory (Create only)
    if (!isEditing && (!description || !description.trim())) {
      showToast("Description is required", "error");
      setLoading(false);
      return;
    }

    const currentUserName =
      getCurrentUserName() ||
      form["Reporter"] ||
      form["Assignee"] ||
      "Unknown User";

    const payload = { ...payloadBase };

    // For CREATE, save description into DB Description (and also first Comment)
    if (!isEditing && description) {
      payload.Description = description;
      payload.Comment = description;

      const firstComment = {
        text: description,
        user: currentUserName,
        timestamp: new Date().toISOString(),
      };
      payload.Comments = [...(payload.Comments || []), firstComment];
    }

    // For EDIT, append new comment if present
    if (isEditing && description) {
      const newComment = {
        text: description,
        user: currentUserName,
        timestamp: new Date().toISOString(),
        isReply: replyingToIndex !== null,
      };

      let updatedComments = [...(form.Comments || [])];

      if (
        replyingToIndex !== null &&
        replyingToIndex >= 0 &&
        replyingToIndex < updatedComments.length
      ) {
        updatedComments.splice(replyingToIndex + 1, 0, newComment);
      } else {
        updatedComments.push(newComment);
      }
      payload.Comments = updatedComments;
    }

    try {
      let savedRow = null;
      const dbPayload = buildDbPayload(payload);

      if (isEditing) {
        const { data, error } = await supabase
          .from(bugTable)
          .update(dbPayload)
          .eq("Bug ID", bugId)
          .select("*")
          .single();

        if (error) throw error;
        savedRow = data;
      } else {
        const { data, error } = await supabase
          .from(bugTable)
          .insert(dbPayload)
          .select("*")
          .single();

        if (error) throw error;
        savedRow = data;
      }

      let saved = normalizeBug(savedRow);
      const savedId = saved["Bug ID"];

      // Handle file uploads
      if (files && files.length > 0) {
        const uploaded = await uploadAttachments(savedId, files);
        const successful = uploaded.filter((u) => u.url);

        const updatedAttachments = [
          ...(saved.Attachments || []),
          ...successful,
        ];

        const { data: updatedData, error: updErr } = await supabase
          .from(bugTable)
          .update({ Attachments: updatedAttachments })
          .eq("Bug ID", savedId)
          .select("*")
          .single();

        if (!updErr && updatedData) {
          saved = normalizeBug(updatedData);
        } else {
          saved.Attachments = updatedAttachments;
        }

        setUploadedFiles(saved.Attachments || []);
      }

      setBugs((prev) => {
        if (isEditing) {
          return prev.map((b) => (b["Bug ID"] === saved["Bug ID"] ? saved : b));
        }
        return [saved, ...prev];
      });

      await fetchBugs();
      setFiles([]);
      setForm({});
      setEditCommentDraft("");
      setReplyingToIndex(null);
      setSelectedBug(null);
      setIsEditing(false);
      setView("list");
      showToast("Bug saved successfully");
    } catch (err) {
      console.error("Submit error:", err);
      showToast("Network/server error while saving bug", "error");
    } finally {
      setLoading(false);
    }
  };

  // Add comment from Edit Bug page and stay in the form
  const handleAddCommentFromEdit = async () => {
    if (!isEditing) return;
    const bugId = form["Bug ID"];
    const commentText = editCommentDraft.trim();

    if (!bugId) {
      alert("Bug ID missing, cannot add comment.");
      return;
    }
    if (!commentText) {
      alert("Please enter a comment before clicking Add Comment.");
      return;
    }

    setCommentSaving(true);
    try {
      const newComment = {
        text: commentText,
        user:
          getCurrentUserName() ||
          form["Reporter"] ||
          form["Assignee"] ||
          "Unknown User",
        timestamp: new Date().toISOString(),
      };

      const updatedComments = [...(form.Comments || []), newComment];

      const payload = {
        ...form,
        Comments: updatedComments,
        "Bug ID": bugId,
        Changed: new Date().toISOString(),
      };

      const dbPayload = buildDbPayload(payload);

      const { data, error } = await supabase
        .from(bugTable)
        .update(dbPayload)
        .eq("Bug ID", bugId)
        .select("*")
        .single();

      if (error) throw error;

      const saved = normalizeBug(data);

      setBugs((prev) =>
        prev.map((b) => (b["Bug ID"] === saved["Bug ID"] ? saved : b))
      );
      setForm(saved);
      setSelectedBug(saved);
      setEditCommentDraft("");
      alert("✅ Comment added");
    } catch (err) {
      console.error("Add comment error:", err);
      alert("Network/server error while adding comment (check console)");
    } finally {
      setCommentSaving(false);
    }
  };

  // Handle Reply action from Details view
  const handleReply = (index = null) => {
    if (!selectedBug) return;
    setForm(selectedBug);
    setUploadedFiles(selectedBug.Attachments || []);
    setIsEditing(true);
    setEditCommentDraft("");
    setReplyingToIndex(index);
    setView("form");
  };

  // Open details: fetch directly from Supabase
  const openBugDetails = async (bug) => {
    const bugId = bug["Bug ID"];
    if (!bugId) return;

    try {
      const { data, error } = await supabase
        .from(bugTable)
        .select("*")
        .eq("Bug ID", bugId)
        .single();

      if (!error && data) {
        const normalized = normalizeBug(data);
        setSelectedBug({
          ...normalized,
          Attachments: Array.isArray(normalized.Attachments)
            ? normalized.Attachments
            : [],
        });
      } else {
        setSelectedBug(bug);
      }
    } catch (e) {
      console.error("Failed to load bug details:", e);
      setSelectedBug(bug);
    }

    setView("details");
  };

  const submitInlineReply = async () => {
    if (!selectedBug || !activeReplyBox || !replyDraft.trim()) return;
    setLoading(true);

    try {
      const bugId = selectedBug["Bug ID"];
      const newComment = {
        text: replyDraft.trim(),
        user:
          getCurrentUserName() || selectedBug["Assignee"] || "Unknown User",
        timestamp: new Date().toISOString(),
        isReply: true,
        level: 0,
        parentType: activeReplyBox.type, // Mark if this is a reply to 'description' or 'comment'
      };

      let updatedComments = [...(selectedBug.Comments || [])];

      if (
        activeReplyBox.type === "comment" &&
        activeReplyBox.index !== null
      ) {
        const parentComment = updatedComments[activeReplyBox.index];

        // Safety check: ensure parent comment exists
        if (parentComment) {
          newComment.level = (parentComment.level || 0) + 1;
          newComment.parentIndex = activeReplyBox.index; // Track parent comment index

          // Do NOT inherit parentType - comment replies should stay in Comments section
          // Always set parentType to 'comment' for replies to comments
          newComment.parentType = "comment";

          updatedComments.splice(activeReplyBox.index + 1, 0, newComment);
        } else {
          // Fallback: append as regular comment
          newComment.parentType = "comment";
          updatedComments.push(newComment);
        }
      } else if (
        activeReplyBox.type === "description" &&
        activeReplyBox.index !== null
      ) {
        // Replying to an existing description reply
        const parentComment = updatedComments[activeReplyBox.index];

        // Safety check: ensure parent comment exists
        if (parentComment) {
          newComment.level = (parentComment.level || 0) + 1;
          newComment.parentIndex = activeReplyBox.index;
          newComment.parentType = "description"; // Keep it in description section

          updatedComments.splice(activeReplyBox.index + 1, 0, newComment);
        } else {
          // Fallback: append as description reply
          newComment.level = 0;
          newComment.parentType = "description";
          updatedComments.push(newComment);
        }
      } else {
        // Replying directly to the main description (no index)
        newComment.level = 0;
        newComment.parentType = "description";
        updatedComments.push(newComment);
      }

      const payload = {
        ...selectedBug,
        Comments: updatedComments,
        "Bug ID": bugId,
        Changed: new Date().toISOString(),
      };

      const dbPayload = buildDbPayload(payload);

      const { data, error } = await supabase
        .from(bugTable)
        .update(dbPayload)
        .eq("Bug ID", bugId)
        .select("*")
        .single();

      if (error) throw error;

      const saved = normalizeBug(data);

      setSelectedBug(saved);
      setBugs((prev) =>
        prev.map((b) => (b["Bug ID"] === saved["Bug ID"] ? saved : b))
      );
      setActiveReplyBox(null);
      setReplyDraft("");
      showToast("Reply added successfully");
    } catch (err) {
      console.error(err);
      showToast("Failed to add reply", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- SEARCH + PAGINATION ---------- */

  const { filteredBugs, totalPages } = useMemo(() => {
    const searchLower = safeLower(search);

    const filteredAll = bugs.filter((b) => {
      const summary = safeLower(b["Summary"]);
      const product = safeLower(b["Product"]);
      const assignee = safeLower(b["Assignee"]);
      const id = String(b["Bug ID"] || "");
      return (
        summary.includes(searchLower) ||
        product.includes(searchLower) ||
        assignee.includes(searchLower) ||
        id.includes(search)
      );
    });

    const total = Math.max(1, Math.ceil(filteredAll.length / ITEMS_PER_PAGE));
    const start = (page - 1) * ITEMS_PER_PAGE;
    const slice = filteredAll.slice(start, start + ITEMS_PER_PAGE);

    return {
      filteredBugs: slice,
      totalPages: total,
    };
  }, [bugs, search, page]);

  /* ---------- RENDERERS ---------- */

  const renderList = () => (
    <div>
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-8">
        <div>
          <Typography
            variant="h4"
            className="text-primary font-bold flex items-center gap-2"
          >
            🪲 Bug Tracker
          </Typography>
          <p className="text-textMuted text-sm mt-1">
            Manage and track all identified issues
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 sm:flex-none">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-textMuted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              type="text"
              placeholder="Search bugs, product, assignee..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="!pl-10 !rounded-lg !border-borderLight focus:!border-accent"
              containerProps={{ className: "min-w-0" }}
            />
          </div>
          <PrimaryButton
            onClick={() => {
              setForm({});
              setUploadedFiles([]);
              setSelectedBug(null);
              setIsEditing(false);
              setEditCommentDraft("");
              setView("form");
            }}
            className="bg-gradient-to-r from-accent to-accentLight hover:from-accentDark hover:to-accent shadow-lg hover:shadow-xl"
          >
            + Create Bug
          </PrimaryButton>
        </div>
      </div>

      <Card className="glass-panel overflow-hidden">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary/95 to-primaryLight/95 text-white">
                  <th className="px-4 py-4 text-left font-semibold uppercase text-xs tracking-wider w-28">
                    Bug ID
                  </th>
                  <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider min-w-[300px] max-w-[400px]">
                    Summary
                  </th>
                  <th className="px-4 py-4 text-center font-semibold uppercase text-xs tracking-wider w-32">
                    Priority
                  </th>
                  <th className="px-4 py-4 text-center font-semibold uppercase text-xs tracking-wider w-32">
                    Status
                  </th>
                  <th className="px-4 py-4 text-left font-semibold uppercase text-xs tracking-wider w-40">
                    Assignee
                  </th>
                  <th className="px-4 py-4 text-left font-semibold uppercase text-xs tracking-wider w-44">
                    Last Edited
                  </th>
                  <th className="px-4 py-4 text-center font-semibold uppercase text-xs tracking-wider w-32">
                    <div className="flex flex-col items-center leading-tight">
                      <span>Actions</span>
                      <span className="text-[10px] font-normal opacity-80">
                        View / Edit
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8">
                      <div className="text-center">
                        <Typography className="text-textMuted">
                          No bugs found
                        </Typography>
                        <p className="text-xs text-textMuted/60 mt-1">
                          Create your first bug to get started
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBugs.map((b) => (
                    <tr
                      key={`${b["Bug ID"]}_${b["Changed"]}`}
                      className="border-b border-borderLight/60 hover:bg-gradient-to-r hover:from-accent/5 hover:to-accent/3 transition-all duration-200"
                    >
                      <td className="px-4 py-4 font-mono text-sm font-semibold text-primary w-28 whitespace-nowrap">
                        {b["Bug ID"]}
                      </td>
                      <td className="px-6 py-4 text-text font-medium text-left max-w-[400px]">
                        <div className="line-clamp-2" title={b["Summary"]}>
                          {b["Summary"]}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center w-32">
                        <span
                          className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold ${getPriorityClass(
                            b["Priority"]
                          )}`}
                        >
                          {b["Priority"] || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center w-32">
                        <span
                          className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold ${getStatusClass(
                            b["Status"]
                          )}`}
                        >
                          {b["Status"] || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-text w-40">
                        <div className="truncate" title={b["Assignee"] || "-"}>
                          {b["Assignee"] || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-text text-xs whitespace-nowrap w-44">
                        {b["Changed"]
                          ? new Date(b["Changed"]).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-4 w-32">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openBugDetails(b)}
                            className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => {
                              setForm(b);
                              setUploadedFiles(b.Attachments || []);
                              setSelectedBug(b);
                              setIsEditing(true);
                              setEditCommentDraft("");
                              setView("form");
                            }}
                            className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                            title="Edit Bug"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-borderLight/60 bg-gradient-to-r from-white/50 to-accent/5">
            <div className="text-sm text-textMuted font-medium">
              Showing{" "}
              {filteredBugs.length ? (page - 1) * ITEMS_PER_PAGE + 1 : 0} -{" "}
              {Math.min(page * ITEMS_PER_PAGE, bugs.length)} of {bugs.length}{" "}
              bugs
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
              <button
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                First
              </button>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Prev
              </button>
              <div className="px-4 py-2 bg-primary/10 rounded-lg text-primary font-bold text-sm">
                {page} / {totalPages}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Next
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Last
              </button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Typography
            variant="h4"
            className="text-primary font-bold flex items-center gap-2"
          >
            {isEditing ? "✏️ Edit a Bug" : "📝 Create New Bug"}
          </Typography>
          <p className="text-textMuted text-sm mt-1">
            {isEditing
              ? "Update the details of the selected bug"
              : "Capture details with smart dropdowns"}
          </p>
        </div>

        {/* 🔹 Back to list */}
        <button
          type="button"
          onClick={() => {
            setView("list");
            setIsEditing(false);
            setSelectedBug(null);
            setForm({});
            setEditCommentDraft("");
          }}
          className="px-4 py-2 rounded-lg border-2 border-borderLight text-text hover:bg-backgroundAlt font-medium transition-all"
        >
          ← Back to List
        </button>
      </div>

      <Card className="glass-panel">
        <CardBody className="p-8">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <SearchableSelect
              label="Defect Type"
              value={form["Defect type"] || "Functional"}
              onChange={(v) => handleChange("Defect type", v)}
              options={[
                { label: "Functional", value: "Functional" },
                { label: "UI", value: "UI" },
                { label: "Performance", value: "Performance" },
                { label: "Security", value: "Security" },
              ]}
            />
            <FormField
              label={
                <span>
                  Summary <span className="text-red-500">*</span>
                </span>
              }
              value={form["Summary"] || ""}
              onChange={(e) => handleChange("Summary", e.target.value)}
              placeholder="Brief description of the bug"
            />
            <SearchableSelect
              label="Select Priority"
              value={form["Priority"] || ""} // empty when not selected
              onChange={(v) => handleChange("Priority", v)}
              options={[
                { label: "Select priority", value: "" }, // 👈 placeholder option
                { label: "Low", value: "Low" },
                { label: "Medium", value: "Medium" },
                { label: "High", value: "High" },
                { label: "Critical", value: "Critical" },
              ]}
            />




            <SearchableSelect
              label="Product"
              value={form["Product"] || ""}
              onChange={(v) => handleChange("Product", v)}
              options={[
                { label: "Select product", value: "" },
                ...productOptions.map((p) => ({
                  label: p,
                  value: p,
                })),
              ]}
            />

            <FormField
              label="Component"
              value={form["Component"] || ""}
              onChange={(e) => handleChange("Component", e.target.value)}
              placeholder="Component affected"
            />
            <FormField
              label="Assignee"
              value={form["Assignee"] || ""}
              onChange={(e) => handleChange("Assignee", e.target.value)}
              placeholder="Team member"
            />
            <FormField
              label="Assignee Real Name"
              value={form["Assignee Real Name"] || ""}
              onChange={(e) =>
                handleChange("Assignee Real Name", e.target.value)
              }
              placeholder="Full name"
            />
            <FormField
              label="Reporter"
              value={form["Reporter"] || ""}
              onChange={(e) => handleChange("Reporter", e.target.value)}
              placeholder="Bug reporter"
            />

            {/* STATUS FIELD */}
            {isEditing ? (
              <SearchableSelect
                label="Status"
                value={form["Status"] || "OPEN"}
                onChange={(v) => handleChange("Status", v)}
                options={[
                  { label: "OPEN", value: "OPEN" },
                  { label: "IN PROGRESS", value: "IN PROGRESS" },
                  { label: "RESOLVED", value: "RESOLVED" },
                  { label: "REOPENED", value: "REOPENED" },
                  { label: "CLOSED", value: "CLOSED" },
                ]}
              />
            ) : (
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value="OPEN"
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-borderLight bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
            )}

            <FormField
              label="Resolution"
              value={form["Resolution"] || ""}
              onChange={(e) => handleChange("Resolution", e.target.value)}
              placeholder="Resolution details"
            />
            <FormField
              label="Sprint details"
              value={form["Sprint details"] || ""}
              onChange={(e) => handleChange("Sprint details", e.target.value)}
              placeholder="Sprint info"
            />
            <SearchableSelect
              label="Automation Intent"
              value={form["Automation Intent"] || "No"}
              onChange={(v) => handleChange("Automation Intent", v)}
              options={[
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ]}
            />
            <FormField
              label="Automation Owner"
              value={form["automation_owner"] || ""}
              onChange={(e) => handleChange("automation_owner", e.target.value)}
              placeholder="Owner name"
            />
            <SearchableSelect
              label="Automation Status"
              value={form["automation status"] || "Pending"}
              onChange={(v) => handleChange("automation status", v)}
              options={[
                { label: "Pending", value: "Pending" },
                { label: "Automated", value: "Automated" },
                { label: "Skipped", value: "Skipped" },
              ]}
            />
            <SearchableSelect
              label="Device type"
              value={form["Device type"] || "Web"}
              onChange={(v) => handleChange("Device type", v)}
              options={[
                { label: "Web", value: "Web" },
                { label: "Mobile", value: "Mobile" },
                { label: "Tablet", value: "Tablet" },
              ]}
            />
            <FormField
              label="Browser tested"
              value={form["Browser tested"] || ""}
              onChange={(e) => handleChange("Browser tested", e.target.value)}
              placeholder="Browser name"
            />

            {/* Description / Comment + Add Comment button */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-primary mb-2">
                {isEditing ? (
                  "Comment"
                ) : (
                  <span>
                    Description <span className="text-red-500">*</span>
                  </span>
                )}
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
                <textarea
                  className="flex-1 rounded-lg border border-borderLight px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent resize-y min-h-[60px]"
                  placeholder={
                    isEditing
                      ? "Add a comment about this bug"
                      : "Detailed description of the bug"
                  }
                  value={editCommentDraft}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditCommentDraft(val);
                  }}
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-primary mb-3">
                📎 Attachments (screenshots, logs)
              </label>
              <div className="border-2 border-dashed border-borderLight rounded-lg p-6 hover:border-accent hover:bg-accent/5 transition-all cursor-pointer relative">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={onFilesChange}
                  className="block w-full h-full cursor-pointer opacity-0 absolute inset-0"
                />
                <div className="text-center pointer-events-none">
                  <svg
                    className="mx-auto h-12 w-12 text-textMuted"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-8-12v12m0 0l-4-4m4 4l4-4"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-textMuted">
                    Drag and drop files or{" "}
                    <span className="font-semibold text-accent">
                      click to browse
                    </span>
                  </p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4 p-4 bg-success/10 rounded-lg border border-success/30">
                  <p className="text-sm font-semibold text-success mb-2">
                    Selected files:
                  </p>
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="text-sm text-text">
                        ✓ {f.name} ({Math.round(f.size / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Display Uploaded Attachments with Previews */}
            </div>

            <div className="col-span-2 flex justify-end gap-3 mt-6 pt-6 border-t border-borderLight">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setIsEditing(false);
                  setSelectedBug(null);
                  setEditCommentDraft("");
                }}
                className="px-6 py-2.5 rounded-lg border-2 border-borderLight text-text hover:bg-backgroundAlt font-medium transition-all"
              >
                Cancel
              </button>
              <PrimaryButton
                type="submit"
                className="bg-gradient-to-r from-accent to-accentLight hover:from-accentDark hover:to-accent shadow-lg hover:shadow-xl"
              >
                {loading
                  ? "Saving..."
                  : isEditing
                    ? "✓ Save Changes"
                    : "✓ Save Bug"}
              </PrimaryButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  const renderDetails = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Typography
            variant="h4"
            className="text-primary font-bold flex items-center gap-2"
          >
            🔍 Bug Details
          </Typography>
          <p className="text-textMuted text-sm mt-1">
            Bug ID:{" "}
            <span className="font-mono font-semibold text-primary">
              {selectedBug?.["Bug ID"]}
            </span>
          </p>
        </div>
        <button
          onClick={() => setView("list")}
          className="px-4 py-2 rounded-lg border-2 border-borderLight text-text hover:bg-backgroundAlt font-medium transition-all"
        >
          ← Back
        </button>
      </div>

      {selectedBug ? (
        <>
          {/* TOP GRID: MAIN DETAILS + QUICK INFO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: main details */}
            <div className="lg:col-span-2">
              <Card className="glass-panel">
                <CardBody className="space-y-6">
                  {/* SUMMARY */}
                  <div>
                    <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-2 text-blue-700">
                      Summary
                    </Typography>
                    <Typography className="text-lg font-semibold text-text break-words">
                      {selectedBug["Summary"] || "N/A"}
                    </Typography>
                  </div>

                  {/* PRIORITY + STATUS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-2 text-blue-700">
                        Priority
                      </Typography>
                      <span
                        className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${getPriorityClass(
                          selectedBug["Priority"]
                        )}`}
                      >
                        {selectedBug["Priority"] || "-"}
                      </span>
                    </div>
                    <div>
                      <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-2 text-blue-700">
                        Status
                      </Typography>
                      <span
                        className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${getStatusClass(
                          selectedBug["Status"]
                        )}`}
                      >
                        {selectedBug["Status"] || "-"}
                      </span>
                    </div>
                  </div>

                  {/* OTHER FIELDS */}
                  <div className="border-t border-borderLight/60 pt-6 grid grid-cols-2 gap-6">
                    {Object.keys(selectedBug).map((k) =>
                      k !== "Bug ID" &&
                        k !== "Summary" &&
                        k !== "Priority" &&
                        k !== "Status" &&
                        k !== "Comments" &&
                        k !== "Attachments" &&
                        k !== "Description" &&
                        k !== "Comment" ? (
                        <div key={k}>
                          <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-1">
                            {k}
                          </Typography>
                          <Typography className="text-sm text-text font-medium break-words">
                            {String(selectedBug[k] ?? "-")}
                          </Typography>
                        </div>
                      ) : null
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* RIGHT: quick info */}
            <div>
              <Card className="glass-panel">
                <CardBody>
                  <Typography className="text-sm font-bold text-blue-700 mb-4 uppercase tracking-wide">
                    Quick Info
                  </Typography>
                  <div className="space-y-4">
                    <div className="bg-accent/10 rounded-lg p-3 border border-accent/30">
                      <div className="text-xs text-textMuted font-semibold mb-1 text-blue-700">
                        Assignee
                      </div>
                      <div className="text-sm font-bold text-blue-700">
                        {selectedBug["Assignee"] || "Unassigned"}
                      </div>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-3 border border-primary/30">
                      <div className="text-xs text-textMuted font-semibold mb-1 text-blue-700">
                        Product
                      </div>
                      <div className="text-sm font-bold text-blue-700">
                        {selectedBug["Product"] || "-"}
                      </div>
                    </div>
                    <div className="bg-info/10 rounded-lg p-3 border border-info/30">
                      <div className="text-xs text-textMuted font-semibold mb-1 text-blue-700">
                        Last Updated
                      </div>
                      <div className="text-sm font-bold text-text text-blue-700">
                        {selectedBug["Changed"]
                          ? new Date(
                            selectedBug["Changed"]
                          ).toLocaleDateString()
                          : "-"}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* COMMENTS CARD - ABOVE DESCRIPTION */}
          {selectedBug.Comments &&
            selectedBug.Comments.filter(
              (c) => c.parentType !== "description"
            ).length > 0 && (
              <div className="mt-6">
                <Card className="glass-panel">
                  <CardBody>
                    <Typography className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-4">
                      Comments
                    </Typography>

                    <div className="space-y-4 overflow-x-auto">
                      {(() => {
                        const renderCommentNode = (node, depth = 0) => {
                          const attachment =
                            (selectedBug.Attachments || [])[node.originalIndex + 1] ||
                            null;

                          return (
                            <div key={node.originalIndex} className="relative">
                              <div
                                className={`p-4 rounded-xl border border-borderLight shadow-sm bg-white ${depth > 0 ? "ml-6" : ""
                                  }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-semibold text-sm text-blue-900">
                                    {node.user || "Unknown User"}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                      {node.timestamp
                                        ? new Date(
                                          node.timestamp
                                        ).toLocaleString()
                                        : "Just now"}
                                    </span>
                                    {activeReplyBox?.type === "comment" &&
                                      activeReplyBox.index ===
                                      node.originalIndex ? null : (
                                      <button
                                        onClick={() =>
                                          setActiveReplyBox({
                                            type: "comment",
                                            index: node.originalIndex,
                                          })
                                        }
                                        className="text-xs font-bold text-accent hover:text-accentDark"
                                      >
                                        Reply
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {attachment &&
                                  (attachment.url ||
                                    attachment.filename) && (
                                    <div className="mb-1 text-sm">
                                      <div
                                        className="text-accent font-semibold cursor-pointer hover:underline block"
                                        onClick={() =>
                                          setPreviewAttachment(attachment)
                                        }
                                      >
                                        {attachment.filename || "Attachment"}
                                      </div>
                                    </div>
                                  )}

                                <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1 break-words">
                                  {node.text}
                                </p>

                                {activeReplyBox?.type === "comment" &&
                                  activeReplyBox.index ===
                                  node.originalIndex && (
                                    <div className="mt-3 pt-3 border-t border-borderLight/50">
                                      <textarea
                                        className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-accent/50 outline-none"
                                        rows={3}
                                        placeholder="Write your reply..."
                                        value={replyDraft}
                                        onChange={(e) =>
                                          setReplyDraft(e.target.value)
                                        }
                                        autoFocus
                                      />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          onClick={() => {
                                            setActiveReplyBox(null);
                                            setReplyDraft("");
                                          }}
                                          className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={submitInlineReply}
                                          disabled={!replyDraft.trim()}
                                          className="px-3 py-1 text-xs font-bold text-white bg-accent hover:bg-accentDark rounded disabled:opacity-50"
                                        >
                                          Submit
                                        </button>
                                      </div>
                                    </div>
                                  )}
                              </div>

                              {/* Nested Children */}
                              {node.children && node.children.length > 0 && (
                                <div className="mt-3 space-y-3 relative">
                                  {node.children.map((child) =>
                                    renderCommentNode(child, depth + 1)
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        };

                        // Filter out description replies - only show comments and their replies
                        // Map original indices BEFORE filtering to preserve correct positions
                        const commentsOnly = (selectedBug.Comments || [])
                          .map((comment, idx) => ({
                            ...comment,
                            originalIndex: idx,
                          }))
                          .filter((c) => c.parentType !== "description");

                        const tree = buildCommentTree(commentsOnly);
                        return tree
                          .reverse()
                          .map((node) => renderCommentNode(node, 0));
                      })()}
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

          {/* DESCRIPTION CARD */}
          <div className="mt-6">
            <Card className="glass-panel">
              <CardBody>
                <Typography className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-4">
                  Description
                </Typography>

                <div className="rounded-2xl bg-primary/5 border border-borderLight shadow-sm px-5 py-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm text-blue-900">
                      {selectedBug.Comments &&
                        selectedBug.Comments[0] &&
                        selectedBug.Comments[0].user
                        ? selectedBug.Comments[0].user
                        : selectedBug["Assignee"] || "Unknown User"}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {selectedBug.Comments &&
                          selectedBug.Comments[0] &&
                          selectedBug.Comments[0].timestamp
                          ? new Date(
                            selectedBug.Comments[0].timestamp
                          ).toLocaleString()
                          : selectedBug["Changed"]
                            ? new Date(
                              selectedBug["Changed"]
                            ).toLocaleString()
                            : ""}
                      </span>
                      {activeReplyBox?.type === "description" &&
                        activeReplyBox.index === undefined ? null : (
                        <button
                          onClick={() =>
                            setActiveReplyBox({ type: "description" })
                          }
                          className="text-xs font-bold text-accent hover:text-accentDark"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedBug.Attachments &&
                    selectedBug.Attachments.length > 0 &&
                    selectedBug.Attachments[0] && (
                      <div className="mb-2 space-y-1">
                        <div className="mb-2">
                          <div className="text-sm">
                            <div
                              className="text-accent font-semibold cursor-pointer hover:underline block"
                              onClick={() =>
                                setPreviewAttachment(
                                  selectedBug.Attachments[0]
                                )
                              }
                            >
                              {selectedBug.Attachments[0].filename ||
                                "Attachment"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {selectedBug.Description &&
                      String(selectedBug.Description).trim()
                      ? selectedBug.Description
                      : selectedBug.Comments &&
                        selectedBug.Comments[0] &&
                        selectedBug.Comments[0].text
                        ? selectedBug.Comments[0].text
                        : "No description available"}
                  </p>

                  {activeReplyBox?.type === "description" &&
                    activeReplyBox.index === undefined && (
                      <div className="mt-4 pt-4 border-t border-borderLight/50">
                        <textarea
                          className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-accent/50 outline-none"
                          rows={3}
                          placeholder="Write your reply..."
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => {
                              setActiveReplyBox(null);
                              setReplyDraft("");
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={submitInlineReply}
                            disabled={!replyDraft.trim()}
                            className="px-3 py-1 text-xs font-bold text-white bg-accent hover:bg-accentDark rounded disabled:opacity-50"
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    )}

                  {/* REPLIES TO DESCRIPTION - Inside the description card with indentation */}
                  {selectedBug.Comments &&
                    selectedBug.Comments.filter(
                      (c) => c.parentType === "description"
                    ).length > 0 && (
                      <div className="mt-4 space-y-3">
                        {selectedBug.Comments
                          .map((comment, idx) => ({
                            ...comment,
                            originalIndex: idx,
                          }))
                          .filter((c) => c.parentType === "description")
                          .reverse()
                          .map((reply) => {
                            const attachment =
                              (selectedBug.Attachments || [])[reply.originalIndex + 1] ||
                              null;

                            return (
                              <div
                                key={reply.originalIndex}
                                className="p-4 rounded-xl border border-borderLight shadow-sm bg-white ml-6"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-semibold text-sm text-blue-900">
                                    {reply.user || "Unknown User"}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                      {reply.timestamp
                                        ? new Date(
                                          reply.timestamp
                                        ).toLocaleString()
                                        : "Just now"}
                                    </span>
                                    {activeReplyBox?.type === "description" &&
                                      activeReplyBox.index ===
                                      reply.originalIndex ? null : (
                                      <button
                                        onClick={() =>
                                          setActiveReplyBox({
                                            type: "description",
                                            index: reply.originalIndex,
                                          })
                                        }
                                        className="text-xs font-bold text-accent hover:text-accentDark"
                                      >
                                        Reply
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {attachment &&
                                  (attachment.url ||
                                    attachment.filename) && (
                                    <div className="mb-2 text-sm">
                                      <div
                                        className="text-accent font-semibold cursor-pointer hover:underline block"
                                        onClick={() =>
                                          setPreviewAttachment(attachment)
                                        }
                                      >
                                        {attachment.filename || "Attachment"}
                                      </div>
                                    </div>
                                  )}

                                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                  {reply.text}
                                </p>

                                {activeReplyBox?.type === "description" &&
                                  activeReplyBox.index ===
                                  reply.originalIndex && (
                                    <div className="mt-3 pt-3 border-t border-borderLight/50">
                                      <textarea
                                        className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-accent/50 outline-none"
                                        rows={3}
                                        placeholder="Write your reply..."
                                        value={replyDraft}
                                        onChange={(e) =>
                                          setReplyDraft(e.target.value)
                                        }
                                        autoFocus
                                      />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          onClick={() => {
                                            setActiveReplyBox(null);
                                            setReplyDraft("");
                                          }}
                                          className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={submitInlineReply}
                                          disabled={!replyDraft.trim()}
                                          className="px-3 py-1 text-xs font-bold text-white bg-accent hover:bg-accentDark rounded disabled:opacity-50"
                                        >
                                          Submit
                                        </button>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      ) : (
        <Typography>No bug selected</Typography>
      )}
    </div>
  );

  const renderAttachmentPreview = () => {
    if (!previewAttachment) return null;
    const u = previewAttachment;
    const url = u.url && u.url.trim() !== "" ? u.url : null;

    if (!url) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md text-center">
            <Typography className="text-red-500 font-bold mb-2">
              Error
            </Typography>
            <p className="text-gray-700 mb-4">
              Attachment URL is missing or invalid.
            </p>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    const isImg =
      /\.(jpeg|jpg|gif|png|webp|bmp|svg)/i.test(url) ||
      (u.filename && /\.(jpeg|jpg|gif|png|webp|bmp|svg)/i.test(u.filename));
    const isVid =
      /\.(mp4|webm|mov|avi|mkv)/i.test(url) ||
      (u.filename && /\.(mp4|webm|mov|avi|mkv)/i.test(u.filename));

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-black/50 text-white border-b border-white/10">
          <div className="text-lg font-semibold truncate max-w-[70%]">
            {u.filename || "Attachment preview"}
          </div>
          <div className="flex items-center gap-4">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accentLight font-medium hover:text-accent hover:underline flex items-center gap-1 transition-colors"
            >
              ⬇ Download
            </a>
            <button
              onClick={() => window.history.back()}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all"
              title="Close Preview"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          {isImg ? (
            <img
              src={url}
              alt={u.filename}
              className="max-w-full max-h-full object-contain shadow-2xl"
            />
          ) : isVid ? (
            <video
              src={url}
              controls
              autoPlay
              className="max-w-full max-h-full shadow-2xl outline-none"
            >
              <source src={url} type={`video/${url.split(".").pop()}`} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-lg overflow-hidden max-w-5xl max-h-[90vh]">
              <iframe
                src={url}
                title={u.filename}
                className="w-full h-full border-0"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-backgroundAlt to-cardDark">
      {/* Preview modal */}
      {renderAttachmentPreview()}

      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {view === "list" && renderList()}
          {view === "form" && renderForm()}
          {view === "details" && renderDetails()}
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${toast.type === "success"
              ? "bg-[#F0FDF4] border-green-200"
              : "bg-red-50 border-red-200"
              }`}
          >
            {/* Icon Box */}
            <div
              className={`rounded-md p-1 flex items-center justify-center ${toast.type === "success" ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {toast.type === "success" ? (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>

            {/* Message */}
            <span
              className={`text-sm font-medium ${toast.type === "success"
                ? "text-green-800"
                : "text-red-800"
                }`}
            >
              {toast.message}
            </span>

            {/* Vertical Separator */}
            <div
              className={`border-l h-6 mx-1 ${toast.type === "success"
                ? "border-green-200"
                : "border-red-200"
                }`}
            />

            {/* Close Button */}
            <button
              onClick={() => setToast({ ...toast, show: false })}
              className={`p-1 hover:bg-black/5 rounded transition-colors ${toast.type === "success"
                ? "text-green-800"
                : "text-red-800"
                }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
