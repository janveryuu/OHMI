"use client";
import Image from "next/image";
import { useState } from "react";

export function LibraryArt({ id, name, priority = false }: { id: string; name: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="library-art">
      {failed ? <p role="img" aria-label={name + " illustration unavailable"}>Illustration unavailable. The component guide is still available below.</p> :
        <Image src={"/app/library/" + id + ".webp"} alt={"Soft Voxel illustration of " + name}
          width={1200} height={900} sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
          priority={priority} onError={() => setFailed(true)} />}
    </div>
  );
}
