"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  maskHeight,
  maskPhone,
  maxBirthDateIso,
  MIN_AGE,
  isAtLeastAge,
  normalizeInstagram,
  onlyDigits,
  sanitizeFileName,
} from "@/lib/masks";
import { LogoImperatriz, WindowDots } from "./Brand";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PHOTO_SLOTS = [
  { id: "rosto", label: "Rosto" },
  { id: "meio", label: "Meio corpo" },
  { id: "inteiro", label: "Corpo inteiro" },
  { id: "extra-1", label: "Foto 4" },
  { id: "extra-2", label: "Foto 5" },
] as const;

const inputClass =
  "w-full rounded-2xl border border-black/10 bg-cream px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink/35 focus:border-green focus:ring-2 focus:ring-lime/70";

type FormDataState = {
  nomeCompleto: string;
  dataNascimento: string;
  endereco: string;
  telefone: string;
  email: string;
  instagram: string;
  altura: string;
  cintura: string;
  quadril: string;
  busto: string;
  tatuagens: string;
  experiencia: string;
};

type FieldKey = keyof FormDataState | "fotos";

const emptyForm: FormDataState = {
  nomeCompleto: "",
  dataNascimento: "",
  endereco: "",
  telefone: "",
  email: "",
  instagram: "",
  altura: "",
  cintura: "",
  quadril: "",
  busto: "",
  tatuagens: "",
  experiencia: "",
};

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

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-ink/80">
        {label}
        {required ? <span className="ml-1 text-green">*</span> : null}
      </span>
      {children}
      {hint && !error ? (
        <span className="block text-xs text-ink/45">{hint}</span>
      ) : null}
      {error ? <span className="block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function InscricaoForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormDataState>(emptyForm);
  const [fotos, setFotos] = useState<(File | null)[]>([null, null, null, null, null]);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [progress, setProgress] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [previews, setPreviews] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const previewRef = useRef<(string | null)[]>([null, null, null, null, null]);

  useEffect(() => {
    return () => {
      previewRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  function update<K extends keyof FormDataState>(key: K, value: FormDataState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

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
    const next: Partial<Record<FieldKey, string>> = {};

    if (form.nomeCompleto.trim().split(/\s+/).length < 2) {
      next.nomeCompleto = "Informe nome e sobrenome.";
    }
    if (!form.dataNascimento) {
      next.dataNascimento = "Informe a data de nascimento.";
    } else if (!isAtLeastAge(form.dataNascimento, MIN_AGE)) {
      next.dataNascimento = `A idade mínima é ${MIN_AGE} anos.`;
    }
    if (form.endereco.trim().length < 8) {
      next.endereco = "Informe o endereço completo.";
    }
    if (onlyDigits(form.telefone).length < 10) {
      next.telefone = "Informe um telefone válido com DDD.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Informe um e-mail válido.";
    }
    if (normalizeInstagram(form.instagram).length < 2) {
      next.instagram = "Informe o Instagram com o perfil aberto.";
    }
    if (!/^\d,\d{2}$/.test(form.altura.trim())) {
      next.altura = "Informe a altura, por exemplo 1,72.";
    }
    if (!form.cintura.trim()) next.cintura = "Informe a cintura.";
    if (!form.quadril.trim()) next.quadril = "Informe o quadril.";
    if (!form.tatuagens.trim()) {
      next.tatuagens = "Informe se possui tatuagens ou piercings visíveis.";
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
      router.push("/obrigada");
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
      if (file.size > MAX_FILE_BYTES) {
        setErrors((current) => ({
          ...current,
          fotos: `Cada foto pode ter no máximo 10 MB. "${file.name}" passa desse limite.`,
        }));
        return;
      }
    }

    setStatus("working");

    try {
      const inscricaoId = crypto.randomUUID();
      const fotoUrls: string[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`Enviando foto ${index + 1} de ${files.length}…`);
        const path = `${inscricaoId}/${index + 1}-${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("inscricoes-fotos")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from("inscricoes-fotos").getPublicUrl(path);
        fotoUrls.push(data.publicUrl);
      }

      setProgress("Salvando sua inscrição…");

      const { error: insertError } = await supabase.from("inscricoes").insert({
        id: inscricaoId,
        nome_completo: form.nomeCompleto.trim(),
        data_nascimento: form.dataNascimento,
        endereco: form.endereco.trim(),
        telefone: maskPhone(form.telefone),
        email: form.email.trim().toLowerCase(),
        instagram: normalizeInstagram(form.instagram),
        altura: form.altura.trim(),
        cintura: form.cintura.trim(),
        quadril: form.quadril.trim(),
        busto: form.busto.trim() || null,
        tatuagens_piercings: form.tatuagens.trim(),
        experiencia: form.experiencia.trim() || null,
        fotos: fotoUrls,
      });

      if (insertError) {
        throw insertError;
      }

      router.push(`/acompanhar/${inscricaoId}?novo=1`);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setSubmitError(
        "Não foi possível enviar sua inscrição agora. Tente novamente em alguns minutos.",
      );
      setProgress("");
    }
  }

  const busy = status === "working";

  return (
    <div className="relative pt-4">
      <div className="absolute top-1 right-5 z-20 rotate-3 rounded-sm bg-lime px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-ink shadow-sm sm:right-8">
        Fique ligada!
      </div>
      <form
        onSubmit={onSubmit}
        className="relative overflow-hidden rounded-[28px] bg-white text-ink shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        noValidate
      >

      <div className="flex items-center justify-between border-b border-black/6 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <WindowDots />
          <LogoImperatriz className="size-8" />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink/40">
          Inscrição online
        </p>
      </div>

      <fieldset disabled={busy} className="space-y-8 px-5 py-8 sm:px-10 sm:py-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-green">
            Primeira etapa
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            Complete o formulário e participe
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            A avaliação do seu perfil será feita pela nossa equipe. Se for
            aprovada, você segue para a etapa presencial na quadra da Imperatriz
            Leopoldinense. Campos com * são obrigatórios.
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

        <section className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">Seus dados</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome completo" required error={errors.nomeCompleto}>
                <input
                  className={inputClass}
                  value={form.nomeCompleto}
                  onChange={(event) => update("nomeCompleto", event.target.value)}
                  autoComplete="name"
                />
              </Field>
            </div>
            <Field
              label="Data de nascimento"
              required
              hint={`Idade mínima: ${MIN_AGE} anos.`}
              error={errors.dataNascimento}
            >
              <input
                type="date"
                className={inputClass}
                value={form.dataNascimento}
                max={maxBirthDateIso(MIN_AGE)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    update("dataNascimento", "");
                    return;
                  }
                  if (!isAtLeastAge(value, MIN_AGE)) {
                    setErrors((current) => ({
                      ...current,
                      dataNascimento: `A idade mínima é ${MIN_AGE} anos.`,
                    }));
                    return;
                  }
                  update("dataNascimento", value);
                }}
              />
            </Field>
            <Field label="Telefone" required error={errors.telefone}>
              <input
                className={inputClass}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(21) 99999-9999"
                value={form.telefone}
                onChange={(event) => update("telefone", maskPhone(event.target.value))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço atual" required error={errors.endereco}>
                <input
                  className={inputClass}
                  autoComplete="street-address"
                  placeholder="Rua, número, bairro, cidade"
                  value={form.endereco}
                  onChange={(event) => update("endereco", event.target.value)}
                />
              </Field>
            </div>
            <Field label="E-mail" required error={errors.email}>
              <input
                type="email"
                className={inputClass}
                autoComplete="email"
                placeholder="voce@email.com"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </Field>
            <Field
              label="Instagram"
              required
              hint="Deixe o perfil aberto, por favor."
              error={errors.instagram}
            >
              <input
                className={inputClass}
                placeholder="@seu.instagram"
                value={form.instagram}
                onChange={(event) => update("instagram", event.target.value)}
                onBlur={() => update("instagram", normalizeInstagram(form.instagram))}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">Medidas</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field
              label="Altura"
              required
              hint="Digite 172 para 1,72"
              error={errors.altura}
            >
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="1,72"
                value={form.altura}
                onChange={(event) => update("altura", maskHeight(event.target.value))}
              />
            </Field>
            <Field
              label="Cintura"
              required
              hint="Ex.: 66 cm"
              error={errors.cintura}
            >
              <input
                className={inputClass}
                placeholder="66 cm"
                value={form.cintura}
                onChange={(event) => update("cintura", event.target.value)}
              />
            </Field>
            <Field
              label="Quadril"
              required
              hint="Ex.: 90 cm"
              error={errors.quadril}
            >
              <input
                className={inputClass}
                placeholder="90 cm"
                value={form.quadril}
                onChange={(event) => update("quadril", event.target.value)}
              />
            </Field>
            <Field label="Busto" hint="Ex.: 72 cm">
              <input
                className={inputClass}
                placeholder="72 cm"
                value={form.busto}
                onChange={(event) => update("busto", event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">Perfil</h3>
          <Field
            label="Possui tatuagens ou piercings visíveis? Se sim, onde?"
            required
            error={errors.tatuagens}
          >
            <textarea
              className={`${inputClass} min-h-[96px] resize-y`}
              placeholder="Não, ou descreva onde."
              value={form.tatuagens}
              onChange={(event) => update("tatuagens", event.target.value)}
            />
          </Field>
          <Field
            label="Experiência como modelo? Se sim, descreva."
            hint="Não precisa ter experiência."
          >
            <textarea
              className={`${inputClass} min-h-[96px] resize-y`}
              placeholder="Primeiro trabalho, agência, campanhas…"
              value={form.experiencia}
              onChange={(event) => update("experiencia", event.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              Fotos <span className="text-green">*</span>
            </h3>
            <p className="mt-1 text-sm text-ink/55">
              Anexe 5 fotos de rosto, meio corpo e corpo inteiro. Fundo liso,
              camiseta preta ou branca e calça jeans ou preta. Até 10 MB por
              arquivo.
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
          className="flex w-full items-center justify-center rounded-full bg-lime px-6 py-4 font-display text-lg font-extrabold text-ink transition hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? progress || "Enviando…" : "Enviar inscrição"}
        </button>
      </fieldset>
    </form>
    </div>
  );
}
