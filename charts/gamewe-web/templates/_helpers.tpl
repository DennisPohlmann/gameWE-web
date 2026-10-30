{{- define "gamewe-web.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "gamewe-web.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "gamewe-web.selector" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "gamewe-web.secretName" -}}
{{- .Values.existingSecret | default (include "gamewe-web.fullname" .) -}}
{{- end -}}

{{/* The health check path below BASE_PATH (without a trailing slash). */}}
{{- define "gamewe-web.healthz" -}}
{{- printf "%s/healthz" (trimSuffix "/" (.Values.env.BASE_PATH | default "")) -}}
{{- end -}}
