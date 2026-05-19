export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      titles: {
        Row: {
          id: string
          tmdb_id: number | null
          imdb_id: string | null
          title: string
          original_title: string | null
          title_type: string
          year: number | null
          runtime_minutes: number | null
          overview: string | null
          poster_path: string | null
          backdrop_path: string | null
          tmdb_rating: number | null
          tmdb_vote_count: number | null
          imdb_rating: number | null
          imdb_vote_count: number | null
          director: string[]
          top_cast: string[]
          genres: string[]
          language: string | null
          origin_country: string | null
          hindi_dub: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tmdb_id?: number | null
          imdb_id?: string | null
          title: string
          original_title?: string | null
          title_type?: string
          year?: number | null
          runtime_minutes?: number | null
          overview?: string | null
          poster_path?: string | null
          backdrop_path?: string | null
          tmdb_rating?: number | null
          tmdb_vote_count?: number | null
          imdb_rating?: number | null
          imdb_vote_count?: number | null
          director?: string[]
          top_cast?: string[]
          genres?: string[]
          language?: string | null
          origin_country?: string | null
          hindi_dub?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tmdb_id?: number | null
          imdb_id?: string | null
          title?: string
          original_title?: string | null
          title_type?: string
          year?: number | null
          runtime_minutes?: number | null
          overview?: string | null
          poster_path?: string | null
          backdrop_path?: string | null
          tmdb_rating?: number | null
          tmdb_vote_count?: number | null
          imdb_rating?: number | null
          imdb_vote_count?: number | null
          director?: string[]
          top_cast?: string[]
          genres?: string[]
          language?: string | null
          origin_country?: string | null
          hindi_dub?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      title_tags: {
        Row: {
          id: string
          title_id: string | null
          tags: Json
          tagged_by: string | null
          tagged_at: string
          version: number
        }
        Insert: {
          id?: string
          title_id?: string | null
          tags?: Json
          tagged_by?: string | null
          tagged_at?: string
          version?: number
        }
        Update: {
          id?: string
          title_id?: string | null
          tags?: Json
          tagged_by?: string | null
          tagged_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "title_tags_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          }
        ]
      }
      streaming_availability: {
        Row: {
          id: string
          title_id: string | null
          region: string
          platform: string
          availability_type: string
          link: string | null
          last_verified: string
        }
        Insert: {
          id?: string
          title_id?: string | null
          region: string
          platform: string
          availability_type: string
          link?: string | null
          last_verified?: string
        }
        Update: {
          id?: string
          title_id?: string | null
          region?: string
          platform?: string
          availability_type?: string
          link?: string | null
          last_verified?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaming_availability_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          region: string
          onboarded: boolean
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          region?: string
          onboarded?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          region?: string
          onboarded?: boolean
          created_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          id: string
          user_id: string | null
          title_id: string | null
          rating: 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen' | 'skip'
          rated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title_id?: string | null
          rating: 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen' | 'skip'
          rated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title_id?: string | null
          rating?: 'loved' | 'liked' | 'meh' | 'disliked' | 'havent_seen' | 'skip'
          rated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_taste_vectors: {
        Row: {
          user_id: string
          vector: Json
          computed_at: string
          rating_count: number
        }
        Insert: {
          user_id: string
          vector?: Json
          computed_at?: string
          rating_count?: number
        }
        Update: {
          user_id?: string
          vector?: Json
          computed_at?: string
          rating_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_taste_vectors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      collections: {
        Row: {
          id: string
          user_id: string | null
          name: string
          description: string | null
          emoji: string
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          description?: string | null
          emoji?: string
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          description?: string | null
          emoji?: string
          is_public?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      collection_items: {
        Row: {
          id: string
          collection_id: string | null
          title_id: string | null
          added_at: string
          note: string | null
        }
        Insert: {
          id?: string
          collection_id?: string | null
          title_id?: string | null
          added_at?: string
          note?: string | null
        }
        Update: {
          id?: string
          collection_id?: string | null
          title_id?: string | null
          added_at?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          }
        ]
      }
      recommendation_log: {
        Row: {
          id: string
          user_id: string | null
          title_id: string | null
          recommended_at: string
          reason_tags: string[]
          action: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          title_id?: string | null
          recommended_at?: string
          reason_tags?: string[]
          action?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          title_id?: string | null
          recommended_at?: string
          reason_tags?: string[]
          action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_log_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          }
        ]
      }
      why_cache: {
        Row: {
          id: string
          title_id: string | null
          taste_cluster: string
          explanation: string
          generated_at: string
        }
        Insert: {
          id?: string
          title_id?: string | null
          taste_cluster: string
          explanation: string
          generated_at?: string
        }
        Update: {
          id?: string
          title_id?: string | null
          taste_cluster?: string
          explanation?: string
          generated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "why_cache_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
