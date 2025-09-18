// components/EditableImage.jsx
'use client';

import Image from "next/image";
import toast from "react-hot-toast";

export default function EditableImage({ link, setLink }) {
  async function handleFileChange(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;

    const uploadPromise = fetch(
      `/api/upload?filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        body: file, // send raw file (NOT FormData)
      }
    ).then(async (res) => {
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setLink(url);
    });

    await toast.promise(uploadPromise, {
      loading: "Uploading...",
      success: "Upload complete",
      error: "Upload error",
    });
  }

  return (
    <>
      {link ? (
        <Image
          className="rounded-lg w-full h-full mb-1 object-cover"
          src={link}
          width={250}
          height={250}
          alt="avatar"
        />
      ) : (
        <div className="text-center bg-gray-200 p-4 text-gray-500 rounded-lg mb-1">
          No image
        </div>
      )}

      <label>
        <input type="file" className="hidden" onChange={handleFileChange} />
        <span className="block border border-gray-300 rounded-lg p-2 text-center cursor-pointer">
          Change image
        </span>
      </label>
    </>
  );
}
