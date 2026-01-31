import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z
  .object({
    image: z.any().optional(),
    link: z.string().optional(),
    comments: z.string().optional(),
  })
  .refine(
    (data) =>
      data.image ||
      (data.link && data.link.trim() !== "") ||
      (data.comments && data.comments.trim() !== ""),
    {
      message: "You must upload something or add a comment.",
      path: ["comments"],
    }
  );

export default function AnalyzeForm() {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      image: undefined,
      link: "",
      comments: "",
    },
  });

  const values = watch();

  const canAnalyze =
    values.image || values.link?.trim() !== "" || values.comments?.trim() !== "";

  function onSubmit(data: z.infer<typeof formSchema>) {
    console.log("Analyze:", data);
    alert("Submitted! Check console for data.");
  }

  return (
    <div style={{ maxWidth: "500px", margin: "20px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Is It Real?</h2>
      <p>Upload content or add details to analyze.</p>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Image Upload */}
        <div style={{ marginBottom: "15px" }}>
          <label>Upload Image</label>
          <Controller
            name="image"
            control={control}
            render={({ field }) => (
              <input
                type="file"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  field.onChange(e.target.files?.[0])
                }
              />
            )}
          />
        </div>

        {/* Link / URL */}
        <div style={{ marginBottom: "15px" }}>
          <label>Paste Link / URL</label>
          <Controller
            name="link"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                placeholder="https://example.com"
                style={{ width: "100%", padding: "8px" }}
              />
            )}
          />
        </div>

        {/* Comments */}
        <div style={{ marginBottom: "15px" }}>
          <label>Comments</label>
          <Controller
            name="comments"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                placeholder="Add any extra details here..."
                rows={4}
                style={{ width: "100%", padding: "8px" }}
              />
            )}
          />
          {errors.comments && (
            <p style={{ color: "red" }}>{errors.comments.message}</p>
          )}
        </div>

        <button type="submit" disabled={!canAnalyze} style={{ padding: "10px 20px" }}>
          Analyze
        </button>
      </form>
    </div>
  );
}
