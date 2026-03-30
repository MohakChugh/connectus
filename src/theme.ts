/**
 * MUI theme configuration for ConnectUs.
 * Security-focused dark theme with restrained palette.
 */
import { createTheme, type Theme } from '@mui/material/styles';

const palette = {
  dark: {
    bg: {
      deepest: '#0a0e14',
      deep: '#121820',
      surface: '#1a2230',
      elevated: '#222d3d',
      hover: '#2a3748',
    },
    text: {
      primary: '#e8edf4',
      secondary: '#8b99ad',
      disabled: '#4d5b6e',
    },
  },
  light: {
    bg: {
      deepest: '#f5f7fa',
      deep: '#ffffff',
      surface: '#f0f2f5',
      elevated: '#ffffff',
      hover: '#e8ecf0',
    },
    text: {
      primary: '#1a2230',
      secondary: '#5a6678',
      disabled: '#9aa5b4',
    },
  },
  accent: {
    blue: '#4fc3f7',
    blueDark: '#0391c9',
    green: '#66bb6a',
    greenDark: '#338a37',
    amber: '#ffa726',
    amberDark: '#c77800',
    red: '#ef5350',
    redDark: '#c62828',
  },
};

const monoFont = "'JetBrains Mono', 'Fira Code', monospace";
const sansFont = "'Inter', 'Roboto', sans-serif";

export function createAppTheme(mode: 'dark' | 'light'): Theme {
  const isDark = mode === 'dark';
  const p = isDark ? palette.dark : palette.light;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.accent.blue,
        dark: palette.accent.blueDark,
        contrastText: '#0a0e14',
      },
      secondary: {
        main: isDark ? '#8b99ad' : '#5a6678',
      },
      success: {
        main: palette.accent.green,
        dark: palette.accent.greenDark,
      },
      warning: {
        main: palette.accent.amber,
        dark: palette.accent.amberDark,
      },
      error: {
        main: palette.accent.red,
        dark: palette.accent.redDark,
      },
      background: {
        default: p.bg.deepest,
        paper: p.bg.surface,
      },
      text: {
        primary: p.text.primary,
        secondary: p.text.secondary,
        disabled: p.text.disabled,
      },
      divider: isDark ? 'rgba(139,153,173,0.12)' : 'rgba(26,34,48,0.12)',
    },
    typography: {
      fontFamily: sansFont,
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.01em' },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500, color: p.text.secondary },
      subtitle2: { fontWeight: 500, color: p.text.secondary },
      body1: { lineHeight: 1.7 },
      body2: { lineHeight: 1.6 },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
      overline: { fontFamily: monoFont, fontSize: '0.7rem', letterSpacing: '0.08em' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: p.bg.deepest,
            backgroundImage: isDark
              ? 'radial-gradient(ellipse at 20% 50%, rgba(79,195,247,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(102,187,106,0.02) 0%, transparent 50%)'
              : 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 10,
            padding: '10px 24px',
            fontSize: '0.938rem',
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${palette.accent.blue} 0%, ${palette.accent.blueDark} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${palette.accent.blue} 20%, ${palette.accent.blueDark} 120%)`,
            },
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: 48,
            minHeight: 48,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? 'rgba(139,153,173,0.08)' : 'rgba(26,34,48,0.08)'}`,
          },
          elevation1: {
            backgroundColor: p.bg.surface,
          },
          elevation2: {
            backgroundColor: p.bg.elevated,
          },
        },
        defaultProps: {
          elevation: 0,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: p.bg.surface,
            border: `1px solid ${isDark ? 'rgba(139,153,173,0.08)' : 'rgba(26,34,48,0.08)'}`,
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              borderColor: isDark ? 'rgba(79,195,247,0.2)' : 'rgba(3,145,201,0.2)',
              boxShadow: isDark
                ? '0 0 20px rgba(79,195,247,0.06)'
                : '0 2px 12px rgba(0,0,0,0.06)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.8rem',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
          standardError: {
            backgroundColor: isDark ? 'rgba(239,83,80,0.1)' : 'rgba(239,83,80,0.08)',
            border: `1px solid rgba(239,83,80,0.3)`,
          },
          standardWarning: {
            backgroundColor: isDark ? 'rgba(255,167,38,0.1)' : 'rgba(255,167,38,0.08)',
            border: `1px solid rgba(255,167,38,0.3)`,
          },
          standardSuccess: {
            backgroundColor: isDark ? 'rgba(102,187,106,0.1)' : 'rgba(102,187,106,0.08)',
            border: `1px solid rgba(102,187,106,0.3)`,
          },
          standardInfo: {
            backgroundColor: isDark ? 'rgba(79,195,247,0.1)' : 'rgba(79,195,247,0.08)',
            border: `1px solid rgba(79,195,247,0.3)`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: p.bg.elevated,
            border: `1px solid ${isDark ? 'rgba(139,153,173,0.12)' : 'rgba(26,34,48,0.12)'}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? p.bg.elevated : '#1a2230',
            color: isDark ? p.text.primary : '#e8edf4',
            fontSize: '0.8rem',
            borderRadius: 8,
            padding: '8px 14px',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
          size: 'small',
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            height: 4,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            border: `1px solid ${isDark ? 'rgba(139,153,173,0.08)' : 'rgba(26,34,48,0.08)'}`,
            '&:before': { display: 'none' },
            '&.Mui-expanded': {
              margin: '0 0 8px 0',
            },
          },
        },
        defaultProps: {
          disableGutters: true,
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            minHeight: 52,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(10,14,20,0.85)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${isDark ? 'rgba(139,153,173,0.08)' : 'rgba(26,34,48,0.08)'}`,
          },
        },
        defaultProps: {
          elevation: 0,
          color: 'transparent',
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: p.bg.deep,
            borderLeft: `1px solid ${isDark ? 'rgba(139,153,173,0.08)' : 'rgba(26,34,48,0.08)'}`,
          },
        },
      },
      MuiSnackbar: {
        defaultProps: {
          anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
        },
      },
    },
  });
}

/** Monospace font family for keys, fingerprints, and safety numbers. */
export const monoFontFamily = monoFont;
