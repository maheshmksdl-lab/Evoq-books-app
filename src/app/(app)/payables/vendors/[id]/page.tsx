"use client";
import { useParams } from "next/navigation";
import { ContactDetail } from "@/components/features/contacts";
export default function Page() { const { id } = useParams<{ id: string }>(); return <ContactDetail id={id} kind="vendor" />; }
