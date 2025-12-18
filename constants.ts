
export const RATP_BLUE = '#004494';
export const RATP_YELLOW = '#ffcd00';
export const DEFAULT_STOP_ID = '120385';

export const getLineColor = (lineId: string): string => {
  const firstDigit = lineId.charAt(0);
  switch (firstDigit) {
    case '1': return '#EBBD02'; // Yellow (Lisboa)
    case '2': return '#C6007E'; // Pink
    case '3': return '#008BD2'; // Blue
    case '4': return '#E30613'; // Red
    default: return '#6f2282'; // Purple
  }
};
