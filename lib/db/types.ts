export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          query?: string
          operationName?: string
          extensions?: Json
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      actions: {
        Row: {
          app_id: string
          basis: string | null
          category: string
          confidence: number | null
          created_at: string
          deadline: string | null
          draft: string | null
          draft_requires_edit: boolean
          effort_min: number | null
          evidence_ids: number[]
          expected_outcome: Json | null
          id: string
          scan_id: string | null
          score_component: string | null
          status: string
          title: string
          verification: Json | null
          verify_state: string
          verify_url: string | null
          why: string | null
        }
        Insert: {
          app_id: string
          basis?: string | null
          category: string
          confidence?: number | null
          created_at?: string
          deadline?: string | null
          draft?: string | null
          draft_requires_edit?: boolean
          effort_min?: number | null
          evidence_ids?: number[]
          expected_outcome?: Json | null
          id?: string
          scan_id?: string | null
          score_component?: string | null
          status?: string
          title: string
          verification?: Json | null
          verify_state?: string
          verify_url?: string | null
          why?: string | null
        }
        Update: {
          app_id?: string
          basis?: string | null
          category?: string
          confidence?: number | null
          created_at?: string
          deadline?: string | null
          draft?: string | null
          draft_requires_edit?: boolean
          effort_min?: number | null
          evidence_ids?: number[]
          expected_outcome?: Json | null
          id?: string
          scan_id?: string | null
          score_component?: string | null
          status?: string
          title?: string
          verification?: Json | null
          verify_state?: string
          verify_url?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          business_type: string | null
          category: string | null
          created_at: string
          icp_mode: string | null
          id: string
          name: string | null
          platform: string
          store_url: string
        }
        Insert: {
          business_type?: string | null
          category?: string | null
          created_at?: string
          icp_mode?: string | null
          id?: string
          name?: string | null
          platform: string
          store_url: string
        }
        Update: {
          business_type?: string | null
          category?: string | null
          created_at?: string
          icp_mode?: string | null
          id?: string
          name?: string | null
          platform?: string
          store_url?: string
        }
        Relationships: []
      }
      competitors: {
        Row: {
          app_id: string
          competitor_store_url: string | null
          confirmed: boolean
          id: string
          name: string | null
          source: string
        }
        Insert: {
          app_id: string
          competitor_store_url?: string | null
          confirmed?: boolean
          id?: string
          name?: string | null
          source: string
        }
        Update: {
          app_id?: string
          competitor_store_url?: string | null
          confirmed?: boolean
          id?: string
          name?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          app_id: string | null
          content: string
          created_at: string
          embedding: string
          id: number
          model: string
          model_version: string
          subject_key: string
          subject_type: string
        }
        Insert: {
          app_id?: string | null
          content: string
          created_at?: string
          embedding: string
          id?: never
          model: string
          model_version: string
          subject_key: string
          subject_type: string
        }
        Update: {
          app_id?: string | null
          content?: string
          created_at?: string
          embedding?: string
          id?: never
          model?: string
          model_version?: string
          subject_key?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          captured_at: string
          excerpt: string | null
          id: number
          scan_id: string
          source_type: string
          url: string | null
        }
        Insert: {
          captured_at?: string
          excerpt?: string | null
          id?: never
          scan_id: string
          source_type: string
          url?: string | null
        }
        Update: {
          captured_at?: string
          excerpt?: string | null
          id?: never
          scan_id?: string
          source_type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_sheets: {
        Row: {
          body: Json
          created_at: string
          evidence_ids: number[]
          expires_at: string
          id: number
          kind: string
          model_version: string
          shared: boolean
          subject_key: string
          subject_type: string
        }
        Insert: {
          body: Json
          created_at?: string
          evidence_ids?: number[]
          expires_at: string
          id?: never
          kind: string
          model_version: string
          shared?: boolean
          subject_key: string
          subject_type: string
        }
        Update: {
          body?: Json
          created_at?: string
          evidence_ids?: number[]
          expires_at?: string
          id?: never
          kind?: string
          model_version?: string
          shared?: boolean
          subject_key?: string
          subject_type?: string
        }
        Relationships: []
      }
      findings: {
        Row: {
          basis: string
          body: Json
          category: string
          confidence: number
          evidence_ids: number[]
          id: string
          scan_id: string
        }
        Insert: {
          basis: string
          body: Json
          category: string
          confidence: number
          evidence_ids?: number[]
          id?: string
          scan_id: string
        }
        Update: {
          basis?: string
          body?: Json
          category?: string
          confidence?: number
          evidence_ids?: number[]
          id?: string
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      monitors: {
        Row: {
          app_id: string
          cadence: string
          id: string
          kind: string
          last_run_at: string | null
          query: string | null
          watermark: Json
        }
        Insert: {
          app_id: string
          cadence?: string
          id?: string
          kind: string
          last_run_at?: string | null
          query?: string | null
          watermark?: Json
        }
        Update: {
          app_id?: string
          cadence?: string
          id?: string
          kind?: string
          last_run_at?: string | null
          query?: string | null
          watermark?: Json
        }
        Relationships: [
          {
            foreignKeyName: "monitors_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          action_id: string | null
          app_id: string
          id: string
          observed_at: string
          observed_delta: Json | null
          verified_signal: string | null
        }
        Insert: {
          action_id?: string | null
          app_id: string
          id?: string
          observed_at?: string
          observed_delta?: Json | null
          verified_signal?: string | null
        }
        Update: {
          action_id?: string | null
          app_id?: string
          id?: string
          observed_at?: string
          observed_delta?: Json | null
          verified_signal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_runs: {
        Row: {
          cost_cents: number
          created_at: string
          critic_rejections: number
          duration_ms: number
          id: number
          model: string | null
          scan_id: string | null
          stage: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          critic_rejections?: number
          duration_ms?: number
          id?: never
          model?: string | null
          scan_id?: string | null
          stage: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          cost_cents?: number
          created_at?: string
          critic_rejections?: number
          duration_ms?: number
          id?: never
          model?: string | null
          scan_id?: string | null
          stage?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_documents: {
        Row: {
          body: Json | null
          content_hash: string
          fetched_at: string
          id: number
          mode: string
          source_type: string
          subject_key: string
          subject_type: string
          url: string | null
        }
        Insert: {
          body?: Json | null
          content_hash: string
          fetched_at?: string
          id?: never
          mode: string
          source_type: string
          subject_key: string
          subject_type: string
          url?: string | null
        }
        Update: {
          body?: Json | null
          content_hash?: string
          fetched_at?: string
          id?: never
          mode?: string
          source_type?: string
          subject_key?: string
          subject_type?: string
          url?: string | null
        }
        Relationships: []
      }
      scan_events: {
        Row: {
          created_at: string
          id: number
          payload: Json
          scan_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: never
          payload?: Json
          scan_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: never
          payload?: Json
          scan_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          app_id: string
          claim_email: string | null
          completed_at: string | null
          cost_cents: number
          findings_payload: Json | null
          id: string
          preliminary_facts: Json | null
          report_payload: Json | null
          score_breakdown: Json | null
          score_total: number | null
          started_at: string | null
          status: string
          tier: string
        }
        Insert: {
          app_id: string
          claim_email?: string | null
          completed_at?: string | null
          cost_cents?: number
          findings_payload?: Json | null
          id?: string
          preliminary_facts?: Json | null
          report_payload?: Json | null
          score_breakdown?: Json | null
          score_total?: number | null
          started_at?: string | null
          status?: string
          tier?: string
        }
        Update: {
          app_id?: string
          claim_email?: string | null
          completed_at?: string | null
          cost_cents?: number
          findings_payload?: Json | null
          id?: string
          preliminary_facts?: Json | null
          report_payload?: Json | null
          score_breakdown?: Json | null
          score_total?: number | null
          started_at?: string | null
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      score_snapshots: {
        Row: {
          app_id: string
          breakdown: Json
          id: string
          installs_reported: number | null
          taken_at: string
          total: number
        }
        Insert: {
          app_id: string
          breakdown: Json
          id?: string
          installs_reported?: number | null
          taken_at?: string
          total: number
        }
        Update: {
          app_id?: string
          breakdown?: Json
          id?: string
          installs_reported?: number | null
          taken_at?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_snapshots_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          app_ids: string[]
          created_at: string
          current_period_end: string | null
          email: string
          founder_voice: Json | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier: string
        }
        Insert: {
          app_ids?: string[]
          created_at?: string
          current_period_end?: string | null
          email: string
          founder_voice?: Json | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
        }
        Update: {
          app_ids?: string[]
          created_at?: string
          current_period_end?: string | null
          email?: string
          founder_voice?: Json | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      match_embeddings: {
        Args: {
          match_count: number
          p_subject_type?: string
          p_app_id?: string
          query: string
        }
        Returns: {
          content: string
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

