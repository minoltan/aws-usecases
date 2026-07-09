import {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
} from "@aws-sdk/client-athena";

const athenaClient = new AthenaClient({});
const COURSE_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

// Demo-scope: synchronously polls Athena inside a single Lambda invocation. A production
// system would precompute this via a scheduled aggregation job rather than block a
// short-lived request on ad hoc query latency (documented known limitation in the README).
export const handler = async (event) => {
    const { courseId } = event.arguments;
    if (!COURSE_ID_PATTERN.test(courseId)) {
        throw new Error("Invalid courseId");
    }

    const year = String(new Date().getUTCFullYear());
    const query = `SELECT COUNT(*) AS total_enrollments FROM raw_events
        WHERE year = '${year}'
        AND "detail-type" = 'Enrollment.EnrollmentCreated'
        AND json_extract_scalar(detail, '$.courseId') = '${courseId}'`;

    const { QueryExecutionId } = await athenaClient.send(new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: { Database: process.env.GLUE_DATABASE },
        WorkGroup: process.env.ATHENA_WORKGROUP,
    }));

    const totalEnrollments = await pollForResult(QueryExecutionId);

    return { courseId, totalEnrollments, completionRate: null };
};

const pollForResult = async (queryExecutionId) => {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
        const { QueryExecution } = await athenaClient.send(new GetQueryExecutionCommand({
            QueryExecutionId: queryExecutionId,
        }));
        const state = QueryExecution.Status.State;

        if (state === "SUCCEEDED") {
            const results = await athenaClient.send(new GetQueryResultsCommand({
                QueryExecutionId: queryExecutionId,
            }));
            const row = results.ResultSet.Rows[1];
            return Number(row?.Data?.[0]?.VarCharValue ?? 0);
        }
        if (state === "FAILED" || state === "CANCELLED") {
            throw new Error(`Athena query ${state}: ${QueryExecution.Status.StateChangeReason}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Athena query timed out");
};
