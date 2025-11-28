import { tasks } from "../data/tasks";
import { useParams, Link } from "react-router-dom";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import GlossyButton from "../components/GlossyButton";

export default function TaskDetails() {
  const { id } = useParams();
  const task = tasks.find((t) => String(t.id) === id);
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-6">
        {!task ? (
          <Typography className="text-gray-700">Task not found.</Typography>
        ) : (
          <Card className="glass-panel">
            <CardBody className="grid gap-3">
  <Typography variant="h5" className="text-primary">{task.title}</Typography>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <p><span className="text-gray-600">Status:</span> {task.status}</p>
                <p><span className="text-gray-600">Owner:</span> {task.owner}</p>
                <p><span className="text-gray-600">Due:</span> {task.due}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <GlossyButton variant="outlined" as={Link} to={`/tasks`} className="bg-white">Back</GlossyButton>
                <GlossyButton as={Link} to={`/tasks/${task.id}/edit`}>Edit</GlossyButton>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}