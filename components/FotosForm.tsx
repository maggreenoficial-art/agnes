"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { maskPhone, normalizeInstagram, onlyDigits, sanitizeFileName } from "@/lib/masks";
import { LogoImperatriz, WindowDots } from "./Brand";
import { reportFunil } from "./FunilPresence";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_FILE_BYTES = 8 * 1024;
const PHOTO_SLOTS = [
  { id: "rosto", label: "Rosto" },
  { id: "meio", label: "Meio corpo" },
  { id: "inteiro", label: "Corpo inteiro" },
  { id: "extra-1", label: "Foto 4" },
  { id: "extra-2", label: "Foto 5" },
] as const;

const inputClass =
  "w-full rounded-2xl border border-black/10 bg-cream px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink/35 focus:border-green focus:ring-2 focus:ring-lime/70";

function isAllowedImage(file: File) {
  if (
    ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(
      file.type,
    )
  ) {
    return true;
  }
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function FotosForm({ nomeInicial = "" }: { nomeInicial?: string }) {
  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [fotos, setFotos] = useState<(File | null)[]>([null, null, null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const previewRef = useRef<(string | null)[]>([null, null, null, null, null]);
  const [errors, setErrors] = useState<{
    nome?: string;
    telefone?: string;
    instagram?: string;
    fotos?: string;
  }>({});
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [progress, setProgress] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    return () => {
      previewRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    const fotoCount = fotos.filter(Boolean).length;
    if (!nome.trim() && !telefone.trim() && !instagram.trim() && fotoCount === 0) return;
    reportFunil({
      etapa: fotoCount > 0 ? "fotos" : "preenchendo",
      campos: [
        ...(nome.trim() ? ["nomeCompleto"] : []),
        ...(telefone ? ["telefone"] : []),
        ...(instagram.trim() ? ["instagram"] : []),
        ...(fotoCount ? ["fotos"] : []),
      ],
      fotos: fotoCount,
    });
  }, [nome, telefone, instagram, fotos]);

  function setFoto(index: number, file: File | null) {
    setFotos((current) => {
      const next = [...current];
      next[index] = file;
      return next;
    });
    setPreviews((current) => {
      const next = [...current];
      if (next[index]) URL.revokeObjectURL(next[index]!);
      next[index] = file ? URL.createObjectURL(file) : null;
      previewRef.current = next;
      return next;
    });
    setErrors((current) => ({ ...current, fotos: undefined }));
  }

  function validate() {
    const next: {
      nome?: string;
      telefone?: string;
      instagram?: string;
      fotos?: string;
    } = {};
    if (nome.trim().split(/\s+/).length < 2) {
      next.nome = "Informe nome e sobrenome.";
    }
    if (onlyDigits(telefone).length < 10) {
      next.telefone = "Informe o mesmo WhatsApp do formulário do Instagram.";
    }
    if (normalizeInstagram(instagram).length < 2) {
      next.instagram = "Informe o Instagram com o perfil aberto.";
    }
    if (fotos.some((file) => !file)) {
      next.fotos = "Anexe as 5 fotos pedidas.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");

    if (honeypot.trim()) {
      window.location.assign("/obrigada?fotos=1");
      return;
    }

    if (!validate()) {
      setSubmitError("Revise os campos destacados para continuar.");
      return;
    }

    const files = fotos.filter((file): file is File => file !== null);
    for (const file of files) {
      if (!isAllowedImage(file)) {
        setErrors((current) => ({
          ...current,
          fotos: "Use arquivos JPG, PNG, WEBP ou HEIC.",
        }));
        return;
      }
      if (file.size < MIN_FILE_BYTES) {
        setErrors((current) => ({
          ...current,
          fotos: `A foto "${file.name}" não carregou. No iPhone, espere a imagem aparecer e tente de novo.`,
        }));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrors((current) => ({
          ...current,
          fotos: `Cada foto pode ter no máximo 10 MB. "${file.name}" passa desse limite.`,
        }));
        return;
      }
    }

    setStatus("working");
    reportFunil({ etapa: "enviando" });

    try {
      const envioId = crypto.randomUUID();
      const fotoUrls: string[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`Enviando foto ${index + 1} de ${files.length}…`);
        const path = `${envioId}/${index + 1}-${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("inscricoes-fotos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("inscricoes-fotos").getPublicUrl(path);
        fotoUrls.push(data.publicUrl);
      }

      setProgress("Salvando suas fotos…");
      const { error } = await supabase.rpc("enviar_fotos_lead", {
        p_nome: nome.trim(),
        p_telefone: maskPhone(telefone),
        p_instagram: normalizeInstagram(instagram),
        p_fotos: fotoUrls,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (
          error.code === "PGRST202" ||
          message.includes("could not find the function")
        ) {
          throw new Error("sql-missing");
        }
        throw error;
      }

      reportFunil({ etapa: "inscrita" });
      window.location.assign("/obrigada?fotos=1");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setSubmitError(
        error instanceof Error && error.message === "sql-missing"
          ? "Falta um passo no banco. Rode supabase/leads-meta-fotos.sql no SQL Editor do Supabase."
          : "Não foi possível enviar as fotos agora. Tente de novo em alguns minutos.",
      );
      setProgress("");
    }
  }

  const busy = status === "working";

  return (
    <div className="relative pt-4">
      <div className="absolute top-1 right-5 z-20 rotate-3 rounded-sm bg-lime px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink shadow-sm sm:right-8">
        Só as fotos
      </div>
      <form
        onSubmit={onSubmit}
        onFocusCapture={() => reportFunil({ etapa: "formulario" })}
        className="relative overflow-hidden rounded-[28px] bg-white text-ink shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        noValidate
      >
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <WindowDots />
            <LogoImperatriz className="size-8" />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink/40">
            Formulário instantâneo
          </p>
        </div>

        <fieldset disabled={busy} className="space-y-8 px-5 py-8 sm:px-10 sm:py-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green">
              Último passo
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              Envie as 5 fotos
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
              Você já preencheu o formulário no Instagram. Aqui só precisamos do
              seu nome, WhatsApp, Instagram e das fotos para a Mix Models
              avaliar o perfil.
            </p>
          </div>

          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 sm:col-span-2">
              <span className="block text-sm font-medium text-ink/80">
                Nome completo <span className="ml-1 text-green">*</span>
              </span>
              <input
                className={inputClass}
                value={nome}
                autoComplete="name"
                onChange={(event) => {
                  setNome(event.target.value);
                  setErrors((current) => ({ ...current, nome: undefined }));
                }}
              />
              {errors.nome ? (
                <span className="block text-xs text-red-600">{errors.nome}</span>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="block text-sm font-medium text-ink/80">
                WhatsApp <span className="ml-1 text-green">*</span>
              </span>
              <input
                className={inputClass}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(21) 99999-9999"
                value={telefone}
                onChange={(event) => {
                  setTelefone(maskPhone(event.target.value));
                  setErrors((current) => ({ ...current, telefone: undefined }));
                }}
              />
              <span className="block text-xs text-ink/45">
                O mesmo número que você usou no anúncio.
              </span>
              {errors.telefone ? (
                <span className="block text-xs text-red-600">{errors.telefone}</span>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="block text-sm font-medium text-ink/80">
                Instagram <span className="ml-1 text-green">*</span>
              </span>
              <input
                className={inputClass}
                placeholder="@seu.instagram"
                value={instagram}
                onChange={(event) => {
                  setInstagram(event.target.value);
                  setErrors((current) => ({ ...current, instagram: undefined }));
                }}
                onBlur={() => setInstagram(normalizeInstagram(instagram))}
              />
              <span className="block text-xs text-ink/45">
                Deixe o perfil aberto, por favor.
              </span>
              {errors.instagram ? (
                <span className="block text-xs text-red-600">{errors.instagram}</span>
              ) : null}
            </label>
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">
                Fotos <span className="text-green">*</span>
              </h3>
              <p className="mt-1 text-sm text-ink/55">
                Rosto, meio corpo e corpo inteiro. Fundo liso, camiseta preta ou
                branca e calça jeans ou preta. Até 10 MB por arquivo.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {PHOTO_SLOTS.map((slot, index) => {
                const file = fotos[index];
                const preview = previews[index];
                return (
                  <label
                    key={slot.id}
                    className={`relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center transition ${
                      file
                        ? "border-green bg-green/5"
                        : "border-black/15 bg-cream hover:border-green hover:bg-lime/20"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
                      className="sr-only"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null;
                        if (!selected) return;
                        if (!isAllowedImage(selected)) {
                          setErrors((current) => ({
                            ...current,
                            fotos: "Use arquivos JPG, PNG, WEBP ou HEIC.",
                          }));
                          return;
                        }
                        if (selected.size < MIN_FILE_BYTES) {
                          setErrors((current) => ({
                            ...current,
                            fotos:
                              "Essa foto não carregou por completo. Espere ela aparecer na galeria e selecione de novo.",
                          }));
                          return;
                        }
                        if (selected.size > MAX_FILE_BYTES) {
                          setErrors((current) => ({
                            ...current,
                            fotos: "Cada foto pode ter no máximo 10 MB.",
                          }));
                          return;
                        }
                        setFoto(index, selected);
                      }}
                    />
                    {preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview}
                          alt={slot.label}
                          className="absolute inset-0 size-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setFoto(index, null);
                          }}
                        >
                          Trocar
                        </button>
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[11px] font-semibold text-white">
                          {slot.label}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl text-green">+</span>
                        <span className="mt-1 px-2 text-xs font-semibold text-ink/70">
                          {slot.label}
                        </span>
                      </>
                    )}
                  </label>
                );
              })}
            </div>
            {errors.fotos ? (
              <p className="text-xs text-red-600">{errors.fotos}</p>
            ) : null}
          </section>

          {submitError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center rounded-full bg-lime px-6 py-4 text-lg font-semibold text-ink transition hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? progress || "Enviando…" : "Enviar fotos"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
