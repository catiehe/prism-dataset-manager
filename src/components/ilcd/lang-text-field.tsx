import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LANGS, getLangText, setLangText, type LangText } from "@/lib/ilcd"

interface LangTextFieldProps {
  label: string
  value: LangText[]
  onChange: (value: LangText[]) => void
  required?: boolean
  multiline?: boolean
  id?: string
}

export function LangTextField({
  label,
  value,
  onChange,
  required,
  multiline,
  id,
}: LangTextFieldProps) {
  const Field = multiline ? Textarea : Input
  return (
    <div className="flex flex-col gap-3">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className={multiline ? "flex flex-col gap-4" : "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2"}>
        {LANGS.map((lang) => (
          <div key={lang} className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">
              {lang === "en" ? "English" : "简体中文"}
            </span>
            <Field
              id={id ? `${id}-${lang}` : undefined}
              required={required && lang === "en"}
              value={getLangText(value, lang)}
              onChange={(e) => onChange(setLangText(value, lang, e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
