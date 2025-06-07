import { Rating, Box, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

interface ScoreRatingProps {
  score: number;
}

const labels: { [index: number]: string } = {
  1: 'Bad',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

export function ScoreRating({ score }: ScoreRatingProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        width: '100%'
      }}
    >
      <Rating
        value={score}
        readOnly
        precision={1}
        sx={{ 
          fontSize: '2.5rem',
        }}
        emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
      />
      <Typography 
        variant="h6" 
        sx={{ 
          fontWeight: 700,
          color: 'text.secondary'
        }}
      >
        {labels[score]}
      </Typography>
    </Box>
  );
} 