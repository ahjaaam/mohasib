import { NextRequest } from "next/server";
import { handleDocumentOcrUpload } from "@/lib/document-ocr-upload";

export async function POST(request: NextRequest) {
  return handleDocumentOcrUpload(request, "purchases");
}
