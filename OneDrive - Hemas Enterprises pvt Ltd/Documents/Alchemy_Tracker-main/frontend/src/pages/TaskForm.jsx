import FormField from "../components/FormField";
import { useState } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import GlossyButton from "../components/GlossyButton";
import { useNavigate } from "react-router-dom";

export default function TaskForm() {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("todo");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    console.log({ title, status, owner, notes });
    navigate("/tasks");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <Card className="glass-panel">
          <CardBody>
            <Typography variant="h6" className="mb-4 text-primary">Create Task</Typography>
            <form className="grid gap-4" onSubmit={submit}>
              <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <FormField
                label="Status"
                type="select"
                value={status}
                onChange={(val) => setStatus(val)}
                options={[
                  { label: "Todo", value: "todo" },
                  { label: "In Progress", value: "in-progress" },
                  { label: "Done", value: "done" },
                ]}
              />
              <FormField label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
              <FormField label="Notes" type="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex items-center gap-3">
                <GlossyButton type="submit">Save</GlossyButton>
                <GlossyButton variant="text" className="bg-transparent text-gray-700 hover:text-accent" onClick={() => navigate("/tasks")}>Cancel</GlossyButton>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}