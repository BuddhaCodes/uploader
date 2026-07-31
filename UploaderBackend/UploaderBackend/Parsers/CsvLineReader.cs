using System.Text;

namespace UploaderBackend.Parsers
{
    public class CsvLineReader
    {
        private readonly List<byte> _pending = new();

        public IEnumerable<string> Feed(byte[] buffer, int count)
        {
            var lines = new List<string>();
            int start = 0;

            for (int i = 0; i < count; i++)
            {
                if (buffer[i] == (byte)'\n')
                {
                    byte[] lineBytes;
                    if (_pending.Count > 0)
                    {
                        _pending.AddRange(new ArraySegment<byte>(buffer, start, i - start));
                        lineBytes = _pending.ToArray();
                        _pending.Clear();
                    }
                    else
                    {
                        lineBytes = new byte[i - start];
                        Array.Copy(buffer, start, lineBytes, 0, i - start);
                    }

                    var line = Encoding.UTF8.GetString(lineBytes).TrimEnd('\r');
                    lines.Add(line);
                    start = i + 1;
                }
            }

            if (start < count)
            {
                _pending.AddRange(new ArraySegment<byte>(buffer, start, count - start));
            }

            return lines;
        }

        public IEnumerable<string> Flush()
        {
            if (_pending.Count == 0)
                yield break;
            var line = Encoding.UTF8.GetString(_pending.ToArray()).TrimEnd('\r');
            _pending.Clear();
            if (line.Length > 0)
                yield return line;
        }
    }
}
